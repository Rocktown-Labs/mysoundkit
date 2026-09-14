FROM python:3.11-slim-bookworm

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Pre-cache Demucs weights so runtime needs no internet (container runs with
# enableInternet=false and only talks to soundkit-r2.internal).
RUN python -c "import demucs.pretrained; demucs.pretrained.get_model('htdemucs')"

COPY src ./src

ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV HF_HUB_OFFLINE=1
EXPOSE 8080

CMD ["python", "src/server.py"]
