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
 * match wins: pits, bases, lanes, mid, river, then jungle.
 *
 * Mid deliberately outranks the river. On the real map mid lane runs straight
 * through the river rather than stopping at it, so the river is two separate
 * arms — Baron side and Dragon side — not one continuous band.
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

    // The Baron pit is sized around the three things that share it — Baron
    // (5007, 10471), Rift Herald (4800, 9894) and the Void Grubs (4790, 10182) —
    // centred on their centroid rather than on Baron, which sits at the back.
    private static final int BARON_PIT_X = 4900;
    private static final int BARON_PIT_Y = 10180;
    private static final int PIT_HALF_SIZE = 700;

    // Summoner's Rift is 180-degree rotationally symmetric, so the Dragon pit is
    // the Baron pit reflected through the map's centre. Derived, not measured,
    // so the two can never drift apart.
    private static final int DRAGON_PIT_X = MAP_MAX - BARON_PIT_X;
    private static final int DRAGON_PIT_Y = MAP_MAX - BARON_PIT_Y;

    public String getZone(int x, int y) {
        // Pits sit inside the river, so they have to be tested before it.
        if (inPit(x, y, BARON_PIT_X, BARON_PIT_Y)) return "Baron Pit";
        if (inPit(x, y, DRAGON_PIT_X, DRAGON_PIT_Y)) return "Dragon Pit";

        if (x <= BASE_DEPTH && y <= BASE_DEPTH) return "Blue Base";
        if (x >= MAP_MAX - BASE_DEPTH && y >= MAP_MAX - BASE_DEPTH) return "Red Base";

        // Both outer lanes are L-shaped: top runs up the left edge and then
        // across the top, bot runs along the bottom and then up the right edge.
        if (x <= LANE_DEPTH || y >= MAP_MAX - LANE_DEPTH) return "Top Lane";
        if (y <= LANE_DEPTH || x >= MAP_MAX - LANE_DEPTH) return "Bot Lane";

        // Mid is tested before the river. Mid lane crosses the river rather than
        // being interrupted by it, so the river resolves as two arms — one on the
        // Baron side, one on the Dragon side — with a gap where mid cuts through.
        if (Math.abs(x - y) <= MID_HALF_WIDTH) return "Mid Lane";
        if (Math.abs(x + y - MAP_MAX) <= RIVER_HALF_WIDTH) return "River";

        // Everything left over is jungle. The river separates blue's half from
        // red's; the mid diagonal separates the top side from the bottom.
        boolean blueHalf = x + y < MAP_MAX;
        boolean topSide = y > x;
        if (blueHalf) return topSide ? "Blue Top Jungle" : "Blue Bot Jungle";
        return topSide ? "Red Top Jungle" : "Red Bot Jungle";
    }

    private boolean inPit(int x, int y, int centreX, int centreY) {
        return Math.abs(x - centreX) <= PIT_HALF_SIZE
            && Math.abs(y - centreY) <= PIT_HALF_SIZE;
    }
}
