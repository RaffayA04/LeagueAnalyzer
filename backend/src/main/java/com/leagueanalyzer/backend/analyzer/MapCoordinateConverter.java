package com.leagueanalyzer.backend.analyzer;
import org.springframework.stereotype.Component;

@Component
public class MapCoordinateConverter {

    private static final double MIN_X = -120;
    private static final double MIN_Y = -120;
    private static final double MAX_X = 14870;
    private static final double MAX_Y = 14980;
    
    private static final int MAP_IMAGE_SIZE = 512;

    public int[] convertToPixel(int x, int y) {
        double normalizedX = (x - MIN_X) / (MAX_X - MIN_X);
        double normalizedY = (y - MIN_Y) / (MAX_Y - MIN_Y);

        int pixelX = (int) (normalizedX * MAP_IMAGE_SIZE);
        int pixelY = MAP_IMAGE_SIZE - (int) (normalizedY * MAP_IMAGE_SIZE);

        return new int[]{pixelX, pixelY};
    }
}
