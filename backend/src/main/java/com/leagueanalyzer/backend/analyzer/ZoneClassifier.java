package com.leagueanalyzer.backend.analyzer;

import org.springframework.stereotype.Component;

@Component
public class ZoneClassifier {

    public String getZone(int x, int y) {
        if (x >= 1500 && x <= 4500 && y >= 9500 && y <= 13000) return "Baron Pit";
        if (x >= 9500 && x <= 12500 && y >= 1500 && y <= 5000) return "Dragon Pit";
        if (x <= 3500 && y >= 10500) return "Top Lane";
        if (x >= 11000 && y <= 4000) return "Bot Lane";
        if (x >= 3000 && x <= 7500 && y >= 7500 && y <= 11500) return "Blue Jungle";
        if (x >= 7500 && x <= 12000 && y >= 3000 && y <= 7500) return "Red Jungle";
        if (x >= 3500 && x <= 11000 && Math.abs(x - y) <= 2500) return "River";
        if (x >= 3500 && x <= 11000) return "Mid Lane";
        if (x <= 3000 && y <= 3000) return "Blue Base";
        if (x >= 11800 && y >= 11800) return "Red Base";
        return "Unknown";
    }
}
