/**
 * Concrete Structural Commands
 * Provides atomic, reversible operations on the structural model.
 */

import { StructuralCommand } from './commandManager';
import { Node3D, Member3D, Support3D, CrossSection, MemberLoad, NormalizedStructuralModel } from '@/features/model/types';

export class AddNodeCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;

  constructor(
    private readonly model: NormalizedStructuralModel,
    private readonly node: Node3D
  ) {
    this.id = `add_node_${node.id}_${Date.now()}`;
    this.timestamp = Date.now();
    this.description = `Add Joint ${node.id} (${node.x.toFixed(2)}, ${node.y.toFixed(2)}, ${node.z.toFixed(2)})`;
  }

  public execute(): void {
    this.model.nodes.set(this.node.id, { ...this.node });
    this.model.statistics.totalNodes = this.model.nodes.size;
  }

  public undo(): void {
    this.model.nodes.delete(this.node.id);
    this.model.statistics.totalNodes = this.model.nodes.size;
  }

  public redo(): void {
    this.execute();
  }
}

export class AddMemberCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;

  constructor(
    private readonly model: NormalizedStructuralModel,
    private readonly member: Member3D
  ) {
    this.id = `add_member_${member.id}_${Date.now()}`;
    this.timestamp = Date.now();
    this.description = `Add Member ${member.id} (${member.classification}) between J${member.startNodeId}-J${member.endNodeId}`;
  }

  public execute(): void {
    this.model.members.set(this.member.id, { ...this.member });
    this.model.statistics.totalMembers = this.model.members.size;
    if (this.member.classification === 'BEAM') {
      this.model.statistics.totalBeams++;
    } else if (this.member.classification === 'COLUMN') {
      this.model.statistics.totalColumns++;
    }
  }

  public undo(): void {
    this.model.members.delete(this.member.id);
    this.model.statistics.totalMembers = this.model.members.size;
    if (this.member.classification === 'BEAM') {
      this.model.statistics.totalBeams = Math.max(0, this.model.statistics.totalBeams - 1);
    } else if (this.member.classification === 'COLUMN') {
      this.model.statistics.totalColumns = Math.max(0, this.model.statistics.totalColumns - 1);
    }
  }

  public redo(): void {
    this.execute();
  }
}

export class AssignSectionCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  private previousSection?: CrossSection;

  constructor(
    private readonly model: NormalizedStructuralModel,
    private readonly memberId: number,
    private readonly newSection: CrossSection
  ) {
    this.id = `assign_sec_${memberId}_${Date.now()}`;
    this.timestamp = Date.now();
    this.description = `Assign Section ${newSection.name || newSection.type} to Member ${memberId}`;
  }

  public execute(): void {
    const member = this.model.members.get(this.memberId);
    if (!member) throw new Error(`Member ${this.memberId} not found in model`);
    this.previousSection = { ...member.section };
    member.section = { ...this.newSection };
  }

  public undo(): void {
    if (!this.previousSection) return;
    const member = this.model.members.get(this.memberId);
    if (member) {
      member.section = { ...this.previousSection };
    }
  }

  public redo(): void {
    this.execute();
  }
}

export class AssignSupportCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  private previousSupport?: Support3D;

  constructor(
    private readonly model: NormalizedStructuralModel,
    private readonly nodeId: number,
    private readonly support: Support3D | null
  ) {
    this.id = `assign_sup_${nodeId}_${Date.now()}`;
    this.timestamp = Date.now();
    this.description = support ? `Assign ${support.type} Support to Joint ${nodeId}` : `Remove Support from Joint ${nodeId}`;
  }

  public execute(): void {
    const existing = this.model.supports.get(this.nodeId);
    this.previousSupport = existing ? { ...existing } : undefined;

    if (this.support) {
      this.model.supports.set(this.nodeId, { ...this.support });
      const node = this.model.nodes.get(this.nodeId);
      if (node) node.isSupport = true;
    } else {
      this.model.supports.delete(this.nodeId);
      const node = this.model.nodes.get(this.nodeId);
      if (node) node.isSupport = false;
    }
    this.model.statistics.totalSupports = this.model.supports.size;
  }

  public undo(): void {
    if (this.previousSupport) {
      this.model.supports.set(this.nodeId, { ...this.previousSupport });
      const node = this.model.nodes.get(this.nodeId);
      if (node) node.isSupport = true;
    } else {
      this.model.supports.delete(this.nodeId);
      const node = this.model.nodes.get(this.nodeId);
      if (node) node.isSupport = false;
    }
    this.model.statistics.totalSupports = this.model.supports.size;
  }

  public redo(): void {
    this.execute();
  }
}

export class AssignMemberLoadCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;
  private previousLoads?: MemberLoad[];

  constructor(
    private readonly model: NormalizedStructuralModel,
    private readonly memberId: number,
    private readonly newLoad: MemberLoad
  ) {
    this.id = `assign_load_${memberId}_${Date.now()}`;
    this.timestamp = Date.now();
    this.description = `Assign ${newLoad.type} Load ${newLoad.w1} kN/m on Member ${memberId}`;
  }

  public execute(): void {
    if (!this.model.memberLoads) {
      this.model.memberLoads = new Map();
    }
    const currentList = this.model.memberLoads.get(this.memberId) || [];
    this.previousLoads = [...currentList];
    this.model.memberLoads.set(this.memberId, [...currentList, { ...this.newLoad }]);
  }

  public undo(): void {
    if (!this.model.memberLoads || !this.previousLoads) return;
    this.model.memberLoads.set(this.memberId, [...this.previousLoads]);
  }

  public redo(): void {
    this.execute();
  }
}

export class BatchTransactionCommand implements StructuralCommand {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly description: string;

  constructor(
    public readonly descriptionText: string,
    private readonly commands: StructuralCommand[]
  ) {
    this.id = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.timestamp = Date.now();
    this.description = descriptionText;
  }

  public async execute(): Promise<void> {
    for (const cmd of this.commands) {
      await cmd.execute();
    }
  }

  public async undo(): Promise<void> {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }

  public async redo(): Promise<void> {
    for (const cmd of this.commands) {
      await cmd.redo();
    }
  }
}
