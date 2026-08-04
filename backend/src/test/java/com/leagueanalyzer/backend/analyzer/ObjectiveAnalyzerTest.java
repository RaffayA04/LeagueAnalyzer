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
        ObjectiveAnalyzer analyzer = new ObjectiveAnalyzer(json, 200);

        assertFalse(analyzer.wasDragonAlive(200000), "not spawned yet");
        assertTrue(analyzer.wasDragonAlive(450000), "alive just before the 458175 kill");
        assertFalse(analyzer.wasDragonAlive(460000), "just killed, respawning");
        assertTrue(analyzer.wasDragonAlive(760000), "respawned at 758175");

    }

    @Test
    void tracksWhichTeamTookEachObjective() throws Exception {
        String json = loadFromResources("fixtures/timeline_NA1_5602190523.json");
        ObjectiveAnalyzer analyzer = new ObjectiveAnalyzer(json, 200);

        // no objective taken yet this early
        assertNull(analyzer.lastDragonTakenBy(200000), "no dragon taken before 3:20");
        assertNull(analyzer.lastBaronTakenBy(200000), "no baron taken before 3:20");

        // team 200 took every dragon in this game
        assertEquals(200, analyzer.lastDragonTakenBy(500000), "first dragon at 458175 went to team 200");

        // barons go 200 (1655218), 200 (2031827), then 100 (2416680)
        assertEquals(200, analyzer.lastBaronTakenBy(1700000), "first baron went to team 200");
        assertEquals(100, analyzer.lastBaronTakenBy(2500000), "last baron went to team 100");
    }

    @Test
    void answersFromThePlayersPerspective() throws Exception {
        String json = loadFromResources("fixtures/timeline_NA1_5602190523.json");

        ObjectiveAnalyzer onTeam200 = new ObjectiveAnalyzer(json, 200);
        ObjectiveAnalyzer onTeam100 = new ObjectiveAnalyzer(json, 100);

        // the same baron reads differently depending on whose side you are on
        assertTrue(onTeam200.myTeamTookLastBaron(1700000), "team 200 took it");
        assertFalse(onTeam100.myTeamTookLastBaron(1700000), "enemy took it");

        // and the last baron flips the other way
        assertFalse(onTeam200.myTeamTookLastBaron(2500000), "enemy took the last baron");
        assertTrue(onTeam100.myTeamTookLastBaron(2500000), "team 100 took the last baron");

        assertFalse(onTeam200.myTeamTookLastDragon(200000), "nothing taken yet");
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
