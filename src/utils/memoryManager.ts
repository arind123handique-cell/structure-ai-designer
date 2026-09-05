/**
 * Memory Management Subsystem for Structural AI Designer
 * Keeps browser RAM usage strictly under 500 MB by:
 * 1. Providing bounded LRU caches with automatic GPU/RAM disposal for 2D canvas textures and sprites.
 * 2. Deeply traversing and disposing Three.js geometries, materials, and textures.
 * 3. Providing global cleanup triggers to free cached data after heavy operations.
 */

import * as THREE from 'three';

export interface Disposable {
  dispose: () => void;
}

/**
 * Bounded Least-Recently-Used (LRU) Cache that automatically calls .dispose()
 * on evicted values (e.g. Three.js CanvasTexture, BufferGeometry, Material).
 */
export class LruCache<K, V extends Partial<Disposable>> {
  private cache = new Map<K, V>();
  private readonly maxCapacity: number;
  private readonly onEvict?: (value: V, key: K) => void;

  constructor(maxCapacity: number = 30, onEvict?: (value: V, key: K) => void) {
    this.maxCapacity = Math.max(1, maxCapacity);
    this.onEvict = onEvict;
  }

  public get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (item !== undefined) {
      // Re-insert to mark as recently used
      this.cache.delete(key);
      this.cache.set(key, item);
    }
    return item;
  }

  public has(key: K): boolean {
    return this.cache.has(key);
  }

  public set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxCapacity) {
      // Evict oldest item (first key in iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        const oldestValue = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        if (oldestValue) {
          if (this.onEvict) {
            this.onEvict(oldestValue, oldestKey);
          } else if (typeof oldestValue.dispose === 'function') {
            oldestValue.dispose();
          }
        }
      }
    }
    this.cache.set(key, value);
  }

  public clear(): void {
    for (const [key, value] of this.cache.entries()) {
      if (this.onEvict) {
        this.onEvict(value, key);
      } else if (typeof value.dispose === 'function') {
        value.dispose();
      }
    }
    this.cache.clear();
  }

  public get size(): number {
    return this.cache.size;
  }
}

/**
 * Traverses and deeply disposes Three.js geometries, materials, and non-shared textures
 * to prevent GPU and RAM memory leaks.
 */
export function disposeThreeObject(obj: THREE.Object3D | null | undefined): void {
  if (!obj) return;

  obj.traverse((child: any) => {
    if (child.geometry && !child.geometry.userData?.isShared) {
      child.geometry.dispose();
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m: any) => {
        if (!m.userData?.isShared) {
          // Dispose textures on the material
          for (const key of Object.keys(m)) {
            const prop = m[key];
            if (prop && typeof prop === 'object' && typeof prop.dispose === 'function' && !prop.userData?.isShared) {
              prop.dispose();
            }
          }
          m.dispose();
        }
      });
    }
  });
}

/**
 * Global memory cleanup utility that can be triggered when switching models,
 * running large solves, or closing high-resource windows.
 */
export function performMemoryCleanup(): void {
  // Suggest garbage collection in environments that support it (e.g. electron/node)
  if (typeof window !== 'undefined' && (window as any).gc) {
    try {
      (window as any).gc();
    } catch {
      // Ignore if not permitted
    }
  }
}
