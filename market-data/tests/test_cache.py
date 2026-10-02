import time

from app.cache import LRUCache, MultiLevelCache


def test_lru_hit_miss_and_stats():
    cache = LRUCache(maxsize=4)
    assert cache.get("a") is None
    cache.set("a", 1, ttl=60)
    assert cache.get("a") == 1
    stats = cache.stats()
    assert stats["hits"] == 1
    assert stats["misses"] == 1
    assert stats["hit_rate"] == 0.5


def test_lru_expiry():
    cache = LRUCache()
    cache.set("a", 1, ttl=0.01)
    time.sleep(0.03)
    assert cache.get("a") is None


def test_lru_evicts_oldest_when_full():
    cache = LRUCache(maxsize=2)
    cache.set("a", 1, ttl=60)
    cache.set("b", 2, ttl=60)
    cache.get("a")  # touch a so b is the LRU
    cache.set("c", 3, ttl=60)
    assert cache.get("a") == 1
    assert cache.get("b") is None
    assert cache.get("c") == 3


async def test_multilevel_promotes_l2_into_l1():
    l1 = LRUCache()

    class FakeL2:
        def __init__(self):
            self.store = {"k": {"v": 42}}
            self.hits = 0
            self.misses = 0

        async def get(self, key):
            if key in self.store:
                self.hits += 1
                return self.store[key]
            self.misses += 1
            return None

        async def set(self, key, value, ttl):
            self.store[key] = value

        def stats(self):
            return {"hits": self.hits, "misses": self.misses}

    l2 = FakeL2()
    mlc = MultiLevelCache(l1, l2, ttl_l1=60, ttl_l2=300)
    # First read: L1 miss, L2 hit, promoted into L1.
    assert await mlc.get("k") == {"v": 42}
    assert l1.get("k") == {"v": 42}
    # Second read served from L1 without touching L2.
    hits_before = l2.hits
    assert await mlc.get("k") == {"v": 42}
    assert l2.hits == hits_before


async def test_multilevel_write_goes_to_both_tiers():
    l1 = LRUCache()

    class FakeL2:
        def __init__(self):
            self.store = {}

        async def get(self, key):
            return self.store.get(key)

        async def set(self, key, value, ttl):
            self.store[key] = value

        def stats(self):
            return {}

    l2 = FakeL2()
    mlc = MultiLevelCache(l1, l2, ttl_l1=60, ttl_l2=300)
    await mlc.set("k", {"v": 7})
    assert l1.get("k") == {"v": 7}
    assert l2.store["k"] == {"v": 7}
    # L2 disabled entirely: L1-only operation still works.
    mlc_no_l2 = MultiLevelCache(LRUCache(), None, ttl_l1=60, ttl_l2=300)
    await mlc_no_l2.set("k", 1)
    assert await mlc_no_l2.get("k") == 1
    assert await mlc_no_l2.get("missing") is None
