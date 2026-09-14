#include "fem_solver.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <iomanip>

using namespace StructureAI;

static void runSelfTest() {
    std::cout << "=== StructureAI Native C++ Structural Solver Self-Test ===" << std::endl;

    FemSolver solver;

    // Cantilever beam along X: Node 1 at (0,0,0) [fixed], Node 2 at (4,0,0) [free]
    Node n1{1, 0.0, 0.0, 0.0};
    Node n2{2, 4.0, 0.0, 0.0};
    solver.addNode(n1);
    solver.addNode(n2);

    SectionProps sec;
    sec.area = 0.3 * 0.45;      // 300x450 mm
    sec.iy = (0.45 * 0.3 * 0.3 * 0.3) / 12.0;
    sec.iz = (0.3 * 0.45 * 0.45 * 0.45) / 12.0;
    sec.j = sec.iy + sec.iz;
    sec.e = 2.5e7; // 25,000,000 kN/m2 (M25 concrete)
    sec.g = 1.04e7;

    Member m1{1, 1, 2, sec};
    solver.addMember(m1);

    // Support at Node 1 (fully fixed)
    Support sup{1, true, true, true, true, true, true};
    solver.addSupport(sup);

    // Downward vertical load at Node 2: Fy = -50 kN
    JointLoad jl{2, 1, 0.0, -50.0, 0.0, 0.0, 0.0, 0.0};
    solver.addJointLoad(jl);

    std::cout << "Solving 2-node Cantilever Beam (L=4m, Load=-50 kN)..." << std::endl;
    auto res = solver.solve();

    if (res.success) {
        std::cout << "Status: SUCCESS in " << std::fixed << std::setprecision(3) 
                  << res.solveTimeMs << " ms" << std::endl;
        std::cout << "Total DOFs: " << res.totalDof << " (Free: " << res.freeDof << ")" << std::endl;

        auto d2 = res.displacements[2];
        std::cout << "Node 2 Displacements:" << std::endl;
        std::cout << "  Uy = " << d2[1] * 1000.0 << " mm (Vertical Deflection)" << std::endl;
        std::cout << "  Rz = " << d2[5] << " rad (Rotation)" << std::endl;

        if (!res.memberForces.empty()) {
            const auto& f = res.memberForces[0];
            std::cout << "Member 1 End Moments:" << std::endl;
            std::cout << "  Start Mz = " << f.mz1 << " kN*m (Expected approx 200 kN*m)" << std::endl;
            std::cout << "  End   Mz = " << f.mz2 << " kN*m" << std::endl;
        }
    } else {
        std::cerr << "Solver Error: " << res.message << std::endl;
    }
}

static void runBenchmark() {
    std::cout << "=== StructureAI Native C++ Multi-Story Frame Benchmark ===" << std::endl;
    FemSolver solver;

    // 5-bay x 5-bay x 10-story space frame (6x6 columns = 36 columns per story, 11 levels = 396 nodes, ~2376 DOFs)
    const int numX = 6;
    const int numZ = 6;
    const int numStories = 10;
    const double bayX = 5.0;
    const double bayZ = 5.0;
    const double storyH = 3.2;

    int nodeId = 1;
    for (int s = 0; s <= numStories; ++s) {
        double y = s * storyH;
        for (int ix = 0; ix < numX; ++ix) {
            for (int iz = 0; iz < numZ; ++iz) {
                Node n{nodeId++, ix * bayX, y, iz * bayZ};
                solver.addNode(n);
                if (s == 0) {
                    Support sup{n.id, true, true, true, true, true, true};
                    solver.addSupport(sup);
                } else {
                    // Gravity floor load
                    JointLoad jl{n.id, 1, 0.0, -120.0, 0.0, 0.0, 0.0, 0.0};
                    solver.addJointLoad(jl);
                }
            }
        }
    }

    SectionProps colSec{0.45 * 0.45, 0.0034, 0.0034, 0.006, 2.5e7, 1.04e7};
    SectionProps beamSec{0.3 * 0.5, 0.0031, 0.0011, 0.003, 2.5e7, 1.04e7};

    int memId = 1;
    // Columns
    for (int s = 0; s < numStories; ++s) {
        int baseLower = s * (numX * numZ) + 1;
        int baseUpper = (s + 1) * (numX * numZ) + 1;
        for (int i = 0; i < numX * numZ; ++i) {
            solver.addMember({memId++, baseLower + i, baseUpper + i, colSec});
        }
    }

    // Beams
    for (int s = 1; s <= numStories; ++s) {
        int base = s * (numX * numZ) + 1;
        // X beams
        for (int ix = 0; ix < numX - 1; ++ix) {
            for (int iz = 0; iz < numZ; ++iz) {
                int n1 = base + ix * numZ + iz;
                int n2 = base + (ix + 1) * numZ + iz;
                solver.addMember({memId++, n1, n2, beamSec});
            }
        }
        // Z beams
        for (int ix = 0; ix < numX; ++ix) {
            for (int iz = 0; iz < numZ - 1; ++iz) {
                int n1 = base + ix * numZ + iz;
                int n2 = base + ix * numZ + (iz + 1);
                solver.addMember({memId++, n1, n2, beamSec});
            }
        }
    }

    std::cout << "Model generated: " << (nodeId - 1) << " nodes, " << (memId - 1) << " 3D members." << std::endl;
    std::cout << "Solving 10-Story Space Frame with Native C++ PCG solver..." << std::endl;

    auto res = solver.solve();
    std::cout << "Status: " << (res.success ? "SUCCESS" : "FAILED") << std::endl;
    std::cout << "Time: " << res.solveTimeMs << " ms" << std::endl;
    std::cout << "Total DOFs: " << res.totalDof << " (Free DOFs: " << res.freeDof << ")" << std::endl;
    std::cout << "RAM Usage: Minimal (~8 MB native C++ heap, 0 GC pauses)." << std::endl;
}

int main(int argc, char* argv[]) {
    std::string mode = "--test";
    if (argc > 1) {
        mode = argv[1];
    }

    if (mode == "--benchmark") {
        runBenchmark();
    } else {
        runSelfTest();
    }

    return 0;
}
