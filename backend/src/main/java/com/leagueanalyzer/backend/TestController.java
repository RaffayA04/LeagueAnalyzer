package com.leagueanalyzer.backend;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class TestController {
    
    @GetMapping("/")
    public String home() {
        return "Backend is working!";
    }
}
