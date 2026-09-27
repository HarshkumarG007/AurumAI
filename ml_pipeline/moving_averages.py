"""
Aurum AI - Moving Averages Calculator
Computes deterministic descriptive moving averages (MA7, MA15, MA30) from price series.
Complies with Aurum_AI_Specification.md §4.1 and RULE-001.
"""

from typing import List, Dict, Optional


def compute_sma(prices: List[float], window: int) -> Optional[float]:
    """
    Computes Simple Moving Average for the given window from the tail of the price series.
    If the series has fewer points than the window, returns average of available points if non-empty,
    or None if empty.
    """
    if not prices:
        return None
    if len(prices) >= window:
        subset = prices[-window:]
    else:
        subset = prices
    
    avg = sum(subset) / len(subset)
    return round(avg, 2)


def compute_all_mas(
    price_series: List[float],
    windows: tuple = (7, 15, 30)
) -> Dict[str, Optional[float]]:
    """
    Computes MA7, MA15, and MA30 for a given chronological list of daily prices.
    The last item in price_series is assumed to be the most recent / current price.
    """
    if not price_series:
        return {"ma7": None, "ma15": None, "ma30": None}
    
    return {
        f"ma{w}": compute_sma(price_series, w)
        for w in windows
    }


def compute_ma_deviation_pct(current_price: float, ma_value: Optional[float]) -> Optional[float]:
    """
    Computes percentage deviation of current price from moving average.
    Returns: ((current_price - ma_value) / ma_value) * 100
    Negative value means current price is below MA.
    """
    if ma_value is None or ma_value == 0:
        return None
    deviation = ((current_price - ma_value) / ma_value) * 100.0
    return round(deviation, 2)
