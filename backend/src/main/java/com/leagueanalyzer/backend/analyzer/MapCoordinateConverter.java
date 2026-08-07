package com.leagueanalyzer.backend.analyzer;
import org.springframework.stereotype.Component;

/**
 * Converts Riot's in-game world coordinates to pixel coordinates on a square
 * minimap image.
 *
 * Two coordinate systems disagree about the origin: Riot's is bottom-left with y
 * growing upward, an image's is top-left with y growing downward. So the y axis
 * is inverted on the way out — miss that and every death renders mirrored, which
 * looks plausible enough to ship by accident.
 *
 * The bounds are centred so that the map's true centre lands at the centre of the
 * image. Baron (5007, 10471) and Dragon (9857, 4422) are 180-degree rotationally
 * symmetric on Summoner's Rift, so the midpoint of their spawns is the real map
 * centre: (7432, 7446.5).
 */
@Component
public class MapCoordinateConverter {

    private static final double CENTRE_X = 7432.0;
    private static final double CENTRE_Y = 7446.5;

    private static final double SPAN_X = 14990;
    private static final double SPAN_Y = 15100;

    private static final double MIN_X = CENTRE_X - SPAN_X / 2;   // -63
    private static final double MIN_Y = CENTRE_Y - SPAN_Y / 2;   // -103.5

    private static final int MAP_IMAGE_SIZE = 512;
    private static final int MAX_PIXEL = MAP_IMAGE_SIZE - 1;

    public int[] convertToPixel(int x, int y) {
        double normalizedX = (x - MIN_X) / SPAN_X;
        double normalizedY = (y - MIN_Y) / SPAN_Y;

        // Scaling by MAX_PIXEL rather than MAP_IMAGE_SIZE keeps the far edge on
        // the last valid pixel instead of one past it. Rounding rather than
        // truncating halves the average error.
        int pixelX = clamp((int) Math.round(normalizedX * MAX_PIXEL));
        int pixelY = clamp((int) Math.round((1 - normalizedY) * MAX_PIXEL));

        return new int[]{pixelX, pixelY};
    }

    /** Positions outside the playable map would otherwise index off the image. */
    private int clamp(int pixel) {
        return Math.max(0, Math.min(MAX_PIXEL, pixel));
    }
}
