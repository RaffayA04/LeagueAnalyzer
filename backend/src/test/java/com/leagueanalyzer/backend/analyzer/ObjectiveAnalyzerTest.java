package com.leagueanalyzer.backend.analyzer;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;


public class ObjectiveAnalyzerTest {

    @Test
    void parsesDragonKillsFromRealTime() throws Exception {
        String json = loadFromResources("fixtures/timeline_NA1_5602190523.json"); //loads it into a string
        ObjectiveAnalyzer analyzer = new ObjectiveAnalyzer(json);

        assertFalse(analyzer.wasDragonAlive(200000), "not spawned yet");
        assertTrue(analyzer.wasDragonAlive(450000), "alive just before the 458175 kill");
        assertFalse(analyzer.wasDragonAlive(460000), "just killed, respawning");
        assertTrue(analyzer.wasDragonAlive(760000), "respawned at 758175");

    }

    public static String loadFromResources(String fileName) throws IOException {
        try (InputStream is = ObjectiveAnalyzerTest.class.getClassLoader().getResourceAsStream(fileName)) {
            if (is == null) {
                throw new IllegalArgumentException("File not found: " + fileName);
            }
                return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

}
