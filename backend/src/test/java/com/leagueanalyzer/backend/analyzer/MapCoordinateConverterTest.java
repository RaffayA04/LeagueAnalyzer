package com.leagueanalyzer.backend.analyzer;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MapCoordinateConverterTest {

    private static final int SIZE = 512;
    private final MapCoordinateConverter converter = new MapCoordinateConverter();

    @Test
    void everyPixelStaysInsideTheImage() {
        // Sweep well past the playable bounds in both directions — nothing may
        // land outside 0..511, or a renderer indexing the image would blow up.
        for (int x = -3000; x <= 18000; x += 250) {
            for (int y = -3000; y <= 18000; y += 250) {
                int[] p = converter.convertToPixel(x, y);
                assertTrue(p[0] >= 0 && p[0] <= SIZE - 1, "x out of range at " + x + "," + y + " -> " + p[0]);
                assertTrue(p[1] >= 0 && p[1] <= SIZE - 1, "y out of range at " + x + "," + y + " -> " + p[1]);
            }
        }
    }

    @Test
    void theYAxisIsInverted() {
        // High in the game is low in the image.
        int[] low = converter.convertToPixel(7432, 2000);
        int[] high = converter.convertToPixel(7432, 13000);
        assertTrue(high[1] < low[1], "a death further up the map must render nearer the top");
    }

    @Test
    void theMapCentreLandsAtTheImageCentre() {
        int[] centre = converter.convertToPixel(7432, 7447);
        assertEquals(255, centre[0], 1, "centre x");
        assertEquals(255, centre[1], 1, "centre y");
    }

    @Test
    void baronAndDragonAreSymmetricAboutTheCentre() {
        // The two pits reflect through the map centre, so their pixels must
        // reflect through the image centre too.
        int[] baron = converter.convertToPixel(5007, 10471);
        int[] dragon = converter.convertToPixel(9857, 4422);

        assertEquals(SIZE - 1, baron[0] + dragon[0], 1, "x positions must mirror");
        assertEquals(SIZE - 1, baron[1] + dragon[1], 1, "y positions must mirror");
    }
}
