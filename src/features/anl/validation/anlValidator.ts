import { Node3D, Member3D, Support3D, Plate3D, JointReaction } from '@/features/model/types';
import { EngineeringWarning } from '@/features/warnings/types';

export class ANLValidator {
  public static validate(
    nodes: Map<number, Node3D>,
    members: Map<number, Member3D>,
    plates: Map<number, Plate3D>,
    supports: Map<number, Support3D>,
    reactions: JointReaction[]
  ): EngineeringWarning[] {
    const warnings: EngineeringWarning[] = [];
    const usedNodeIds = new Set<number>();

    // 1. Validate Members
    for (const [id, member] of members.entries()) {
      // Check zero length
      if (member.length <= 0.001) {
        warnings.push({
          id: `val_zerolen_${id}`,
          severity: 'CRITICAL',
          category: 'MODEL',
          elementRef: `Member #${id}`,
          message: `Member #${id} has zero or near-zero length (${member.length} m).`,
          source: 'ANL Validator',
          action: 'Verify member start and end node coordinates in STAAD.',
        });
      }

      // Check node references
      if (!nodes.has(member.startNodeId)) {
        warnings.push({
          id: `val_missing_start_${id}`,
          severity: 'CRITICAL',
          category: 'MODEL',
          elementRef: `Member #${id}`,
          message: `Member #${id} references missing start Node #${member.startNodeId}.`,
          source: 'ANL Validator',
          action: 'Check JOINT COORDINATES in input file.',
        });
      } else {
        usedNodeIds.add(member.startNodeId);
      }

      if (!nodes.has(member.endNodeId)) {
        warnings.push({
          id: `val_missing_end_${id}`,
          severity: 'CRITICAL',
          category: 'MODEL',
          elementRef: `Member #${id}`,
          message: `Member #${id} references missing end Node #${member.endNodeId}.`,
          source: 'ANL Validator',
          action: 'Check JOINT COORDINATES in input file.',
        });
      } else {
        usedNodeIds.add(member.endNodeId);
      }

      // Check section assignment
      if (!member.section.yd || !member.section.zd) {
        warnings.push({
          id: `val_missing_section_${id}`,
          severity: 'WARNING',
          category: 'INPUT',
          elementRef: `Member #${id}`,
          message: `Member #${id} has unassigned or default cross-section properties.`,
          source: 'ANL Validator',
          action: 'Review MEMBER PROPERTY commands in STAAD.',
        });
      }
    }

    // 2. Validate Plates
    for (const [id, plate] of plates.entries()) {
      for (const nid of plate.nodeIds) {
        if (!nodes.has(nid)) {
          warnings.push({
            id: `val_plate_node_${id}_${nid}`,
            severity: 'CRITICAL',
            category: 'MODEL',
            elementRef: `Plate #${id}`,
            message: `Plate #${id} references missing Node #${nid}.`,
            source: 'ANL Validator',
            action: 'Check ELEMENT INCIDENCES in STAAD.',
          });
        } else {
          usedNodeIds.add(nid);
        }
      }
    }

    // 3. Check for Orphan Nodes (nodes not connected to any member or plate)
    let orphanCount = 0;
    for (const [nid] of nodes.entries()) {
      if (!usedNodeIds.has(nid) && !supports.has(nid)) {
        orphanCount++;
      }
    }

    if (orphanCount > 0) {
      warnings.push({
        id: 'val_orphans',
        severity: 'INFO',
        category: 'MODEL',
        message: `Found ${orphanCount} unattached orphan joint(s) not referenced by any member or plate.`,
        source: 'ANL Validator',
        action: 'Clean up unused joints if not required for load application.',
      });
    }

    // 4. Validate Supports and Reactions
    const reactionNodeIds = new Set(reactions.map((r) => r.nodeId));
    for (const [suppNodeId] of supports.entries()) {
      if (!reactionNodeIds.has(suppNodeId)) {
        warnings.push({
          id: `val_supp_noreact_${suppNodeId}`,
          severity: 'WARNING',
          category: 'ANALYSIS',
          elementRef: `Support Joint #${suppNodeId}`,
          message: `Support Joint #${suppNodeId} has no computed reactions in analysis output.`,
          source: 'ANL Validator',
          action: 'Ensure PERFORM ANALYSIS and PRINT SUPPORT REACTIONS were executed.',
        });
      }
    }

    return warnings;
  }
}
