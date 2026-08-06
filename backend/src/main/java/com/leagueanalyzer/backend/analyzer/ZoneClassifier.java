package com.leagueanalyzer.backend.analyzer;

import org.springframework.stereotype.Component;

/**
 * Maps Riot world coordinates to a named region of Summoner's Rift.
 *
 * The map's structure comes from two diagonals, both confirmed against fixed
 * landmark positions in real timeline data:
 *
 *   mid lane   runs along  x == y            (blue nexus ~1750,1900 -> red nexus ~13000,12900)
 *   the river  runs along  x + y == MAP_MAX  (Baron 5007,10471 and Dragon 9857,4422 both sit on it)
 *
 * Those two diagonals cross at the centre and cut the remaining space into the
 * four jungle quadrants. Checks are ordered most specific first, and the first
 * match wins.
 */
@Component
public class ZoneClassifier {

    // Riot's world coordinates run from roughly -120 to ~14870 on both axes.
    // Blue base sits at low x / low y; red base at high x / high y.
    private static final int MAP_MAX = 14870;

    private static final int MID_HALF_WIDTH = 1500;
    private static final int RIVER_HALF_WIDTH = 1500;

    // How far in from an edge still counts as lane, and the corner square
    // around each nexus that counts as base.
    private static final int LANE_DEPTH = 1700;
    private static final int BASE_DEPTH = 2800;

    public String getZone(int x, int y) {
        // Pits sit inside the river, so they have to be tested before it.
        if (inBox(x, y, 3800, 9300, 6200, 11700)) return "Baron Pit";
        if (inBox(x, y, 8700, 3200, 11100, 5600)) return "Dragon Pit";

        if (x <= BASE_DEPTH && y <= BASE_DEPTH) return "Blue Base";
        if (x >= MAP_MAX - BASE_DEPTH && y >= MAP_MAX - BASE_DEPTH) return "Red Base";

        // Both outer lanes are L-shaped: top runs up the left edge and then
        // across the top, bot runs along the bottom and then up the right edge.
        if (x <= LANE_DEPTH || y >= MAP_MAX - LANE_DEPTH) return "Top Lane";
        if (y <= LANE_DEPTH || x >= MAP_MAX - LANE_DEPTH) return "Bot Lane";

        if (Math.abs(x + y - MAP_MAX) <= RIVER_HALF_WIDTH) return "River";
        if (Math.abs(x - y) <= MID_HALF_WIDTH) return "Mid Lane";

        // Everything left over is jungle. The river separates blue's half from
        // red's; the mid diagonal separates the top side from the bottom.
        boolean blueHalf = x + y < MAP_MAX;
        boolean topSide = y > x;
        if (blueHalf) return topSide ? "Blue Top Jungle" : "Blue Bot Jungle";
        return topSide ? "Red Top Jungle" : "Red Bot Jungle";
    }

    private boolean inBox(int x, int y, int minX, int minY, int maxX, int maxY) {
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
}
