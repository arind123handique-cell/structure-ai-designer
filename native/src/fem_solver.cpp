#include "fem_solver.hpp"
#include <chrono>
#include <iostream>
#include <algorithm>
#include <array>

namespace StructureAI {

void FemSolver::addNode(const Node& node) {
    nodeIndexMap_[node.id] = static_cast<int>(nodes_.size());
    nodes_.push_back(node);
}

void FemSolver::addMember(const Member& member) {
    members_.push_back(member);
}

void FemSolver::addSupport(const Support& support) {
    supports_.push_back(support);
}

void FemSolver::addJointLoad(const JointLoad& load) {
    jointLoads_.push_back(load);
}

void FemSolver::addMemberLoad(const MemberLoad& load) {
    memberLoads_.push_back(load);
}

void FemSolver::clear() {
    nodes_.clear();
    members_.clear();
    supports_.clear();
    jointLoads_.clear();
    memberLoads_.clear();
    nodeIndexMap_.clear();
}

static std::array<std::array<double, 12>, 12> buildLocalStiffness(const Member& mem, double L) {
    std::array<std::array<double, 12>, 12> k = {};
    if (L <= 1e-6) return k;

    const double E = mem.section.e;
    const double G = mem.section.g;
    const double A = mem.section.area;
    const double Iy = mem.section.iy;
    const double Iz = mem.section.iz;
    const double J = mem.section.j;

    const double L2 = L * L;
    const double L3 = L2 * L;

    const double EA_L = E * A / L;
    const double GJ_L = G * J / L;

    // Bending about z (in local xy plane)
    const double EIz_12_L3 = 12.0 * E * Iz / L3;
    const double EIz_6_L2 = 6.0 * E * Iz / L2;
    const double EIz_4_L = 4.0 * E * Iz / L;
    const double EIz_2_L = 2.0 * E * Iz / L;

    // Bending about y (in local xz plane)
    const double EIy_12_L3 = 12.0 * E * Iy / L3;
    const double EIy_6_L2 = 6.0 * E * Iy / L2;
    const double EIy_4_L = 4.0 * E * Iy / L;
    const double EIy_2_L = 2.0 * E * Iy / L;

    // Axial (x)
    k[0][0] = EA_L;   k[0][6] = -EA_L;
    k[6][0] = -EA_L;  k[6][6] = EA_L;

    // Shear y & Moment z
    k[1][1] = EIz_12_L3;   k[1][5] = EIz_6_L2;    k[1][7] = -EIz_12_L3;  k[1][11] = EIz_6_L2;
    k[5][1] = EIz_6_L2;    k[5][5] = EIz_4_L;     k[5][7] = -EIz_6_L2;   k[5][11] = EIz_2_L;
    k[7][1] = -EIz_12_L3;  k[7][5] = -EIz_6_L2;   k[7][7] = EIz_12_L3;   k[7][11] = -EIz_6_L2;
    k[11][1] = EIz_6_L2;   k[11][5] = EIz_2_L;    k[11][7] = -EIz_6_L2;  k[11][11] = EIz_4_L;

    // Shear z & Moment y
    k[2][2] = EIy_12_L3;   k[2][4] = -EIy_6_L2;   k[2][8] = -EIy_12_L3;  k[2][10] = -EIy_6_L2;
    k[4][2] = -EIy_6_L2;   k[4][4] = EIy_4_L;     k[4][8] = EIy_6_L2;    k[4][10] = EIy_2_L;
    k[8][2] = -EIy_12_L3;  k[8][4] = EIy_6_L2;    k[8][8] = EIy_12_L3;   k[8][10] = EIy_6_L2;
    k[10][2] = -EIy_6_L2;  k[10][4] = EIy_2_L;    k[10][8] = EIy_6_L2;   k[10][10] = EIy_4_L;

    // Torsion (rx)
    k[3][3] = GJ_L;   k[3][9] = -GJ_L;
    k[9][3] = -GJ_L;  k[9][9] = GJ_L;

    return k;
}

static std::array<std::array<double, 3>, 3> buildRotationMatrix(const Node& n1, const Node& n2, double& outL) {
    double dx = n2.x - n1.x;
    double dy = n2.y - n1.y;
    double dz = n2.z - n1.z;
    outL = std::sqrt(dx * dx + dy * dy + dz * dz);
    if (outL <= 1e-6) {
        return {{{1,0,0},{0,1,0},{0,0,1}}};
    }

    double rx = dx / outL;
    double ry = dy / outL;
    double rz = dz / outL;

    double vx[3] = {rx, ry, rz};
    double vy[3] = {0, 0, 0};
    double vz[3] = {0, 0, 0};

    // Check if vertical member (aligned with global Y)
    if (std::abs(rx) < 1e-5 && std::abs(rz) < 1e-5) {
        if (ry > 0) {
            // Pointing up: local z along global Z
            vz[0] = 0; vz[1] = 0; vz[2] = 1;
            vy[0] = -1; vy[1] = 0; vy[2] = 0;
        } else {
            // Pointing down
            vz[0] = 0; vz[1] = 0; vz[2] = 1;
            vy[0] = 1; vy[1] = 0; vy[2] = 0;
        }
    } else {
        // General non-vertical member: local z is horizontal (perpendicular to global Y)
        double d = std::sqrt(rx * rx + rz * rz);
        vz[0] = -rz / d;
        vz[1] = 0;
        vz[2] = rx / d;

        // vy = vz x vx
        vy[0] = vz[1] * vx[2] - vz[2] * vx[1];
        vy[1] = vz[2] * vx[0] - vz[0] * vx[2];
        vy[2] = vz[0] * vx[1] - vz[1] * vx[0];
    }

    std::array<std::array<double, 3>, 3> R = {};
    for (int i = 0; i < 3; ++i) {
        R[0][i] = vx[i];
        R[1][i] = vy[i];
        R[2][i] = vz[i];
    }
    return R;
}

SolveResult FemSolver::solve() {
    auto tStart = std::chrono::high_resolution_clock::now();
    SolveResult result;

    if (nodes_.empty() || members_.empty()) {
        result.success = false;
        result.message = "No nodes or members defined.";
        return result;
    }

    const int numNodes = static_cast<int>(nodes_.size());
    const int totalDof = numNodes * 6;
    result.totalDof = totalDof;

    // Track fixed DOFs
    std::vector<bool> isFixed(totalDof, false);
    for (const auto& sup : supports_) {
        auto it = nodeIndexMap_.find(sup.nodeId);
        if (it != nodeIndexMap_.end()) {
            int base = it->second * 6;
            if (sup.fixUx) isFixed[base + 0] = true;
            if (sup.fixUy) isFixed[base + 1] = true;
            if (sup.fixUz) isFixed[base + 2] = true;
            if (sup.fixRx) isFixed[base + 3] = true;
            if (sup.fixRy) isFixed[base + 4] = true;
            if (sup.fixRz) isFixed[base + 5] = true;
        }
    }

    int freeCount = 0;
    for (bool f : isFixed) {
        if (!f) freeCount++;
    }
    result.freeDof = freeCount;

    // Sparse matrix representation (Compressed Row / Row adjacency)
    struct Triplet {
        int r;
        int c;
        double val;
    };
    std::vector<Triplet> triplets;
    triplets.reserve(members_.size() * 144);

    // Assemble member stiffness
    for (const auto& mem : members_) {
        auto it1 = nodeIndexMap_.find(mem.startNodeId);
        auto it2 = nodeIndexMap_.find(mem.endNodeId);
        if (it1 == nodeIndexMap_.end() || it2 == nodeIndexMap_.end()) continue;

        int n1Idx = it1->second;
        int n2Idx = it2->second;
        const auto& n1 = nodes_[n1Idx];
        const auto& n2 = nodes_[n2Idx];

        double L = 0.0;
        auto R = buildRotationMatrix(n1, n2, L);
        auto kLocal = buildLocalStiffness(mem, L);

        // Transformation matrix T (12x12) from R (3x3 blocks)
        std::array<std::array<double, 12>, 12> T = {};
        for (int b = 0; b < 4; ++b) {
            for (int r = 0; r < 3; ++r) {
                for (int c = 0; c < 3; ++c) {
                    T[b * 3 + r][b * 3 + c] = R[r][c];
                }
            }
        }

        // kGlobal = T^T * kLocal * T
        // Temp = kLocal * T
        std::array<std::array<double, 12>, 12> temp = {};
        for (int i = 0; i < 12; ++i) {
            for (int j = 0; j < 12; ++j) {
                double sum = 0.0;
                for (int m = 0; m < 12; ++m) {
                    sum += kLocal[i][m] * T[m][j];
                }
                temp[i][j] = sum;
            }
        }

        std::array<std::array<double, 12>, 12> kGlobal = {};
        for (int i = 0; i < 12; ++i) {
            for (int j = 0; j < 12; ++j) {
                double sum = 0.0;
                for (int m = 0; m < 12; ++m) {
                    sum += T[m][i] * temp[m][j];
                }
                kGlobal[i][j] = sum;
            }
        }

        int dofMap[12];
        for (int d = 0; d < 6; ++d) {
            dofMap[d] = n1Idx * 6 + d;
            dofMap[d + 6] = n2Idx * 6 + d;
        }

        for (int r = 0; r < 12; ++r) {
            int gr = dofMap[r];
            for (int c = 0; c < 12; ++c) {
                int gc = dofMap[c];
                triplets.push_back({gr, gc, kGlobal[r][c]});
            }
        }
    }

    // Assemble load vector F
    std::vector<double> F(totalDof, 0.0);
    for (const auto& jl : jointLoads_) {
        auto it = nodeIndexMap_.find(jl.nodeId);
        if (it != nodeIndexMap_.end()) {
            int base = it->second * 6;
            F[base + 0] += jl.fx;
            F[base + 1] += jl.fy;
            F[base + 2] += jl.fz;
            F[base + 3] += jl.mx;
            F[base + 4] += jl.my;
            F[base + 5] += jl.mz;
        }
    }

    // Convert triplets to CRS / Map for fast matrix-vector product
    std::vector<std::unordered_map<int, double>> K(totalDof);
    for (const auto& tri : triplets) {
        K[tri.r][tri.c] += tri.val;
    }

    // Apply boundary conditions: for fixed DOFs, set diag = 1.0, off-diags = 0, F = 0
    for (int i = 0; i < totalDof; ++i) {
        if (isFixed[i]) {
            K[i].clear();
            K[i][i] = 1.0;
            F[i] = 0.0;
        } else {
            for (auto it = K[i].begin(); it != K[i].end(); ) {
                if (it->first != i && isFixed[it->first]) {
                    it = K[i].erase(it);
                } else {
                    ++it;
                }
            }
        }
    }

    // Diagonal Preconditioned Conjugate Gradient (PCG) solver
    std::vector<double> u(totalDof, 0.0);
    std::vector<double> r = F;
    std::vector<double> z(totalDof, 0.0);
    std::vector<double> diagInv(totalDof, 1.0);

    for (int i = 0; i < totalDof; ++i) {
        double d = K[i][i];
        if (std::abs(d) > 1e-12) {
            diagInv[i] = 1.0 / d;
        } else {
            diagInv[i] = 1.0;
        }
        z[i] = r[i] * diagInv[i];
    }

    std::vector<double> p = z;
    double rzOld = 0.0;
    for (int i = 0; i < totalDof; ++i) rzOld += r[i] * z[i];

    const int maxIters = std::max(500, totalDof * 2);
    const double tol = 1e-6;

    std::vector<double> Ap(totalDof, 0.0);
    for (int iter = 0; iter < maxIters; ++iter) {
        // Ap = K * p
        for (int i = 0; i < totalDof; ++i) {
            double sum = 0.0;
            for (const auto& pair : K[i]) {
                sum += pair.second * p[pair.first];
            }
            Ap[i] = sum;
        }

        double pAp = 0.0;
        for (int i = 0; i < totalDof; ++i) pAp += p[i] * Ap[i];
        if (std::abs(pAp) < 1e-20) break;

        double alpha = rzOld / pAp;
        for (int i = 0; i < totalDof; ++i) {
            u[i] += alpha * p[i];
            r[i] -= alpha * Ap[i];
        }

        double rNorm = 0.0;
        for (int i = 0; i < totalDof; ++i) rNorm += r[i] * r[i];
        if (std::sqrt(rNorm) < tol) break;

        for (int i = 0; i < totalDof; ++i) {
            z[i] = r[i] * diagInv[i];
        }

        double rzNew = 0.0;
        for (int i = 0; i < totalDof; ++i) rzNew += r[i] * z[i];

        double beta = rzNew / rzOld;
        for (int i = 0; i < totalDof; ++i) {
            p[i] = z[i] + beta * p[i];
        }
        rzOld = rzNew;
    }

    // Extract node displacements
    for (const auto& node : nodes_) {
        int idx = nodeIndexMap_[node.id];
        int base = idx * 6;
        result.displacements[node.id] = {
            u[base + 0], u[base + 1], u[base + 2],
            u[base + 3], u[base + 4], u[base + 5]
        };
    }

    // Compute member internal forces
    for (const auto& mem : members_) {
        int n1Idx = nodeIndexMap_[mem.startNodeId];
        int n2Idx = nodeIndexMap_[mem.endNodeId];

        double L = 0.0;
        auto R = buildRotationMatrix(nodes_[n1Idx], nodes_[n2Idx], L);
        auto kLocal = buildLocalStiffness(mem, L);

        std::array<std::array<double, 12>, 12> T = {};
        for (int b = 0; b < 4; ++b) {
            for (int r = 0; r < 3; ++r) {
                for (int c = 0; c < 3; ++c) {
                    T[b * 3 + r][b * 3 + c] = R[r][c];
                }
            }
        }

        double uGlobal[12];
        for (int d = 0; d < 6; ++d) {
            uGlobal[d] = u[n1Idx * 6 + d];
            uGlobal[d + 6] = u[n2Idx * 6 + d];
        }

        // uLocal = T * uGlobal
        double uLocal[12] = {0};
        for (int i = 0; i < 12; ++i) {
            for (int j = 0; j < 12; ++j) {
                uLocal[i] += T[i][j] * uGlobal[j];
            }
        }

        // fLocal = kLocal * uLocal
        double fLocal[12] = {0};
        for (int i = 0; i < 12; ++i) {
            for (int j = 0; j < 12; ++j) {
                fLocal[i] += kLocal[i][j] * uLocal[j];
            }
        }

        MemberEndForces forces;
        forces.memberId = mem.id;
        forces.loadCaseId = 1;
        forces.axial1 = fLocal[0];
        forces.vy1 = fLocal[1];
        forces.vz1 = fLocal[2];
        forces.torsion1 = fLocal[3];
        forces.my1 = fLocal[4];
        forces.mz1 = fLocal[5];

        forces.axial2 = fLocal[6];
        forces.vy2 = fLocal[7];
        forces.vz2 = fLocal[8];
        forces.torsion2 = fLocal[9];
        forces.my2 = fLocal[10];
        forces.mz2 = fLocal[11];

        result.memberForces.push_back(forces);
    }

    auto tEnd = std::chrono::high_resolution_clock::now();
    result.solveTimeMs = std::chrono::duration<double, std::milli>(tEnd - tStart).count();
    result.success = true;
    result.message = "Analysis complete.";

    return result;
}

} // namespace StructureAI
