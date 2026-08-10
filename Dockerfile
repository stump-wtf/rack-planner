# rack-planner ships as-is: plain ES modules, no bundler, no dependencies.
# There is nothing to build, so this is a single stage that copies static files
# behind nginx. The only real work is serving .js with the right MIME type and
# NOT caching un-hashed assets forever.
#
# Tests are the CI gate (`make test`), not a Docker build stage — running them
# here would need node in the image for no runtime benefit.

FROM nginxinc/nginx-unprivileged:1.31-alpine

# Apply Alpine security patches so the Trivy CRITICAL/HIGH gate passes
# legitimately rather than by being waived. The 1.27-alpine base shipped
# openssl 3.3.3-r0, libexpat, libpng and c-ares with 2 CRITICAL + 31 HIGH
# between them; the newer base plus this upgrade clears them.
USER root
RUN apk --no-cache upgrade
USER 101

LABEL org.opencontainers.image.title="rack-planner" \
      org.opencontainers.image.description="Snap-to-grid planning for 10\" mini racks" \
      org.opencontainers.image.source="https://gitea.stump.rocks/stump.wtf/rack-planner" \
      org.opencontainers.image.url="https://rack-planner.stump.rocks" \
      org.opencontainers.image.licenses="MIT"

COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css/ /usr/share/nginx/html/css/
COPY js/  /usr/share/nginx/html/js/

# the base image already runs as uid 101 (nginx); stay there
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/bin/sh", "-c", "wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1"]

CMD ["nginx", "-g", "daemon off;"]
