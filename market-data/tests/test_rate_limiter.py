import time

import pytest

from app.rate_limiter import TokenBucket


async def test_acquire_within_burst_is_instant():
    bucket = TokenBucket(rate_per_sec=100, capacity=5)
    start = time.monotonic()
    for _ in range(5):
        waited = await bucket.acquire()
        assert waited == 0.0
    assert time.monotonic() - start < 1.0


async def test_acquire_beyond_burst_throttles():
    bucket = TokenBucket(rate_per_sec=10, capacity=2)
    await bucket.acquire()
    await bucket.acquire()
    start = time.monotonic()
    waited = await bucket.acquire()
    elapsed = time.monotonic() - start
    # One token at 10/sec takes ~0.1s to refill.
    assert 0.05 < elapsed < 2.0
    assert waited > 0


async def test_refill_recovers_capacity():
    bucket = TokenBucket(rate_per_sec=1000, capacity=2)
    await bucket.acquire()
    await bucket.acquire()
    assert bucket.available < 0.5
    # After a short sleep the bucket refills.
    import asyncio

    await asyncio.sleep(0.05)
    assert bucket.available > 1.0


async def test_acquire_more_than_capacity_rejected():
    bucket = TokenBucket(rate_per_sec=10, capacity=2)
    with pytest.raises(ValueError):
        await bucket.acquire(3)


def test_snapshot_reports_state():
    bucket = TokenBucket(rate_per_sec=10, capacity=4)
    snap = bucket.snapshot()
    assert snap["rate_per_sec"] == 10
    assert snap["capacity"] == 4
    assert snap["available"] == 4
