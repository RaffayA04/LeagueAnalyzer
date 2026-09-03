# Build and run the Spring Boot backend. Works on any host that takes a
# Dockerfile — Railway, Render, Fly, Cloud Run.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Dependencies first, so a source-only change reuses the cached layer.
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
# Tests are skipped deliberately: BackendApplicationTests boots the Spring
# context, which needs riot.api.key, and the key is an environment variable
# that only exists at runtime. Tests run locally, not in the image.
# maven.test.skip (not skipTests) because .dockerignore omits src/test
# entirely — skipTests would still try to compile sources that are not here.
RUN mvn -B clean package -Dmaven.test.skip=true

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar

# Hosts assign a port at runtime and expect the app to bind it.
ENV PORT=8080
EXPOSE 8080

# The JVM defaults to a quarter of container memory for heap, which on a 512 MB
# instance is ~128 MB — tight once Jackson holds a ~1.2 MB timeline as a tree
# alongside Spring's own footprint. 75% leaves room for metaspace and threads
# while giving the parse enough headroom to avoid constant GC.
CMD ["sh", "-c", "java -XX:MaxRAMPercentage=75 -jar app.jar --server.port=${PORT}"]
