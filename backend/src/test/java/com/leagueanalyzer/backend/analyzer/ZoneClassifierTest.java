package com.leagueanalyzer.backend.analyzer;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ZoneClassifierTest {

    private final ZoneClassifier classifier = new ZoneClassifier();

    // Objectives spawn at fixed spots, so their positions are free ground truth.
    // These came out of a real timeline (match NA1_5602190523).
    // Baron, Rift Herald and the Void Grubs all spawn in the same pit, so the box
    // has to be wide enough to hold all three — not just centred on Baron.
    // Positions are real, taken from timeline data.
    @Test
    void everythingThatSharesTheBaronPitLandsInIt() {
        assertEquals("Baron Pit", classifier.getZone(5007, 10471), "Baron");
        assertEquals("Baron Pit", classifier.getZone(4800, 9894), "Rift Herald");
        assertEquals("Baron Pit", classifier.getZone(4790, 10182), "Void Grubs");
    }

    @Test
    void dragonLandsInItsOwnPit() {
        assertEquals("Dragon Pit", classifier.getZone(9857, 4422), "Dragon's actual spawn");
    }

    @Test
    void nexusesAreInTheirBase() {
        assertEquals("Blue Base", classifier.getZone(1750, 1900));
        assertEquals("Red Base", classifier.getZone(13000, 12900));
    }

    @Test
    void midRunsAlongOneDiagonalAndTheRiverAlongTheOther() {
        // mid lane is x == y
        assertEquals("Mid Lane", classifier.getZone(9301, 9701), "red-side mid");
        assertEquals("Mid Lane", classifier.getZone(5200, 4900), "blue-side mid");

        // the river is x + y == MAP_MAX, perpendicular to mid
        assertEquals("River", classifier.getZone(6240, 8154), "top-side river");
        assertEquals("River", classifier.getZone(8300, 6400), "bot-side river");

        // Mid lane runs straight through the river rather than stopping at it, so
        // the crossing at map centre is mid.
        assertEquals("Mid Lane", classifier.getZone(7400, 7400), "mid cuts through the river");
    }

    @Test
    void theRiverIsTwoArmsSplitByMidLane() {
        // Walking the river diagonal from the Baron side to the Dragon side:
        // river, then a gap where mid crosses, then river again. Both sample
        // points sit on x + y = 14870 but outside either pit box.
        assertEquals("River", classifier.getZone(6600, 8270), "Baron-side arm");
        assertEquals("Mid Lane", classifier.getZone(7435, 7435), "the gap where mid crosses");
        assertEquals("River", classifier.getZone(8270, 6600), "Dragon-side arm");
    }

    @Test
    void lanesCoverBothArmsOfTheirL() {
        // top lane runs up the left edge, then across the top
        assertEquals("Top Lane", classifier.getZone(945, 5683), "left edge");
        assertEquals("Top Lane", classifier.getZone(7000, 13500), "top edge");

        // bot lane runs along the bottom, then up the right edge
        assertEquals("Bot Lane", classifier.getZone(7000, 1200), "bottom edge");
        assertEquals("Bot Lane", classifier.getZone(13800, 7883), "right edge");
    }

    @Test
    void allFourJungleQuadrantsAreReachable() {
        assertEquals("Blue Top Jungle", classifier.getZone(4200, 7600));
        assertEquals("Blue Bot Jungle", classifier.getZone(6187, 4407));
        assertEquals("Red Top Jungle", classifier.getZone(8000, 11500));
        assertEquals("Red Bot Jungle", classifier.getZone(11614, 5666));
    }

    // The whole point of the rewrite: nothing on the playable map falls through.
    @Test
    void noPlayableCoordinateIsUnknown() {
        for (int x = 200; x < 14800; x += 100) {
            for (int y = 200; y < 14800; y += 100) {
                // skip the two dead corners that are outside the playable map
                if (x + y < 3000 || x + y > 26700) continue;
                assertNotEquals("Unknown", classifier.getZone(x, y), "gap at " + x + "," + y);
            }
        }
    }
}
