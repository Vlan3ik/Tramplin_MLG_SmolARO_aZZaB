FROM minio/mc:latest AS mc

FROM alpine:3.21
RUN apk add --no-cache coreutils
COPY --from=mc /usr/bin/mc /usr/local/bin/mc
