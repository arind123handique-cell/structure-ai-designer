#include "fem_solver.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>

namespace StructureAI {

/**
 * High-performance streaming ANL parser in C++.
 * Reads multi-megabyte STAAD .ANL / .STD files using a single line buffer,
 * avoiding any heap fragmentation or memory allocation spikes.
 */
bool parseStaadFileFast(const std::string& filePath, FemSolver& solver) {
    std::ifstream file(filePath);
    if (!file.is_open()) {
        std::cerr << "Failed to open STAAD file: " << filePath << std::endl;
        return false;
    }

    std::string line;
    std::string currentSection = "";

    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '*') continue;

        // Clean trailing CR
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }

        // Section header checks
        if (line.find("JOINT COORDINATES") != std::string::npos) {
            currentSection = "JOINTS";
            continue;
        } else if (line.find("MEMBER INCIDENCES") != std::string::npos) {
            currentSection = "MEMBERS";
            continue;
        } else if (line.find("SUPPORTS") != std::string::npos) {
            currentSection = "SUPPORTS";
            continue;
        } else if (line.find("PERFORM ANALYSIS") != std::string::npos) {
            currentSection = "ANALYSIS";
            continue;
        }

        if (currentSection == "JOINTS") {
            std::stringstream ss(line);
            int id = 0;
            double x = 0.0, y = 0.0, z = 0.0;
            if (ss >> id >> x >> y >> z) {
                solver.addNode({id, x, y, z});
            }
        } else if (currentSection == "MEMBERS") {
            std::stringstream ss(line);
            int memId = 0, n1 = 0, n2 = 0;
            if (ss >> memId >> n1 >> n2) {
                SectionProps defSec;
                solver.addMember({memId, n1, n2, defSec});
            }
        } else if (currentSection == "SUPPORTS") {
            std::stringstream ss(line);
            int nodeId = 0;
            std::string type;
            if (ss >> nodeId >> type) {
                if (type.find("FIXED") != std::string::npos) {
                    solver.addSupport({nodeId, true, true, true, true, true, true});
                } else if (type.find("PINNED") != std::string::npos) {
                    solver.addSupport({nodeId, true, true, true, false, false, false});
                }
            }
        }
    }

    return true;
}

} // namespace StructureAI
