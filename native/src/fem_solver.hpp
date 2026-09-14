#pragma once

#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>
#include <memory>

namespace StructureAI {

struct Vec3 {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
};

struct Node {
    int id = 0;
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
};

struct SectionProps {
    double area = 0.1; // m^2
    double iy = 0.001; // m^4
    double iz = 0.001; // m^4
    double j = 0.002;  // m^4
    double e = 2.5e7;  // kN/m^2 (M25 concrete = 25 GPa)
    double g = 1.04e7; // kN/m^2
};

struct Member {
    int id = 0;
    int startNodeId = 0;
    int endNodeId = 0;
    SectionProps section;
};

struct Support {
    int nodeId = 0;
    bool fixUx = true;
    bool fixUy = true;
    bool fixUz = true;
    bool fixRx = true;
    bool fixRy = true;
    bool fixRz = true;
};

struct LoadCase {
    int id = 1;
    std::string name = "DEAD LOAD";
};

struct JointLoad {
    int nodeId = 0;
    int loadCaseId = 1;
    double fx = 0.0; // kN
    double fy = 0.0;
    double fz = 0.0;
    double mx = 0.0; // kN*m
    double my = 0.0;
    double mz = 0.0;
};

struct MemberLoad {
    int memberId = 0;
    int loadCaseId = 1;
    double wy = 0.0; // kN/m
    double wz = 0.0;
};

struct MemberEndForces {
    int memberId = 0;
    int loadCaseId = 1;
    // Station 1 (Start)
    double axial1 = 0.0;
    double vy1 = 0.0;
    double vz1 = 0.0;
    double torsion1 = 0.0;
    double my1 = 0.0;
    double mz1 = 0.0;
    // Station 2 (End)
    double axial2 = 0.0;
    double vy2 = 0.0;
    double vz2 = 0.0;
    double torsion2 = 0.0;
    double my2 = 0.0;
    double mz2 = 0.0;
};

struct JointReaction {
    int nodeId = 0;
    int loadCaseId = 1;
    double fx = 0.0;
    double fy = 0.0;
    double fz = 0.0;
    double mx = 0.0;
    double my = 0.0;
    double mz = 0.0;
};

struct SolveResult {
    bool success = false;
    std::string message;
    double solveTimeMs = 0.0;
    int totalDof = 0;
    int freeDof = 0;
    // Displacements: map of nodeId -> (6 DOFs: ux, uy, uz, rx, ry, rz)
    std::unordered_map<int, std::vector<double>> displacements;
    std::vector<MemberEndForces> memberForces;
    std::vector<JointReaction> reactions;
};

class FemSolver {
public:
    FemSolver() = default;

    void addNode(const Node& node);
    void addMember(const Member& member);
    void addSupport(const Support& support);
    void addJointLoad(const JointLoad& load);
    void addMemberLoad(const MemberLoad& load);

    SolveResult solve();

    void clear();

private:
    std::vector<Node> nodes_;
    std::vector<Member> members_;
    std::vector<Support> supports_;
    std::vector<JointLoad> jointLoads_;
    std::vector<MemberLoad> memberLoads_;

    std::unordered_map<int, int> nodeIndexMap_;
};

} // namespace StructureAI
