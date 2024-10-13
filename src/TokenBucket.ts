export class TokenBucket<_Key> {
  public max: number;
  public refillIntervalSeconds: number;

  constructor(max: number, refillIntervalSeconds: number) {
    this.max = max;
    this.refillIntervalSeconds = refillIntervalSeconds;
  }

  private storage = new Map<_Key, Bucket>();

  public consume(key: _Key, cost: number): boolean {
    let bucket = this.storage.get(key) ?? null;
    const now = Date.now();
    if (bucket === null) {
      bucket = {
        count: this.max - cost,
        refilledAt: now,
      };
      this.storage.set(key, bucket);
      return true;
    }
    const refill = Math.floor(
      (now - bucket.refilledAt) / (this.refillIntervalSeconds * 1000)
    );
    bucket.count = Math.min(bucket.count + refill, this.max);
    bucket.refilledAt = now;
    if (bucket.count < cost) {
      return false;
    }
    bucket.count -= cost;
    this.storage.set(key, bucket);
    return true;
  }
}

interface Bucket {
  count: number;
  refilledAt: number;
}

// Bucket that has 10 tokens max and refills at a rate of 2 tokens/sec
let ip;
const bucket = new TokenBucket<string>(10, 2);

if (!bucket.consume(ip, 1)) {
  throw new Error("Too many requests");
}

//const SCRIPT_SHA = await client.scriptLoad(script);
