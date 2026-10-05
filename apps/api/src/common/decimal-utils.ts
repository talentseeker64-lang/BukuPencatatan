import { Decimal } from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class MoneyUtils {
  /**
   * Safely calculates item total: quantity * unit_price
   */
  static calculateItemTotal(quantity: string | number, unitPrice: string | number): string {
    const qty = new Decimal(quantity);
    const price = new Decimal(unitPrice);

    if (qty.isNegative() || qty.isZero()) {
      throw new Error('Quantity must be greater than zero');
    }
    if (price.isNegative()) {
      throw new Error('Unit price cannot be negative');
    }

    return qty.times(price).toFixed(2);
  }

  /**
   * Safely calculates the total sum of an array of item total prices
   */
  static sumTotals(itemTotals: string[]): string {
    let sum = new Decimal(0);
    for (const total of itemTotals) {
      sum = sum.plus(new Decimal(total));
    }
    return sum.toFixed(2);
  }

  /**
   * Converts decimal string to minor units string (e.g. 100000000.00 -> 10000000000)
   */
  static toMinorUnits(decimalAmount: string): string {
    const d = new Decimal(decimalAmount);
    return d.times(100).toFixed(0);
  }

  /**
   * Validates if string represents a valid non-negative decimal currency
   */
  static isValidAmount(amountStr: string): boolean {
    try {
      const d = new Decimal(amountStr);
      return !d.isNaN() && d.isFinite() && !d.isNegative();
    } catch {
      return false;
    }
  }

  /**
   * Validates if quantity is strictly positive
   */
  static isValidQuantity(qty: number | string): boolean {
    try {
      const d = new Decimal(qty);
      return !d.isNaN() && d.isFinite() && d.isPositive() && !d.isZero();
    } catch {
      return false;
    }
  }

  /**
   * Compares two amounts (returns 0 if equal, 1 if a > b, -1 if a < b)
   */
  static compare(a: string, b: string): number {
    return new Decimal(a).comparedTo(new Decimal(b));
  }
}
