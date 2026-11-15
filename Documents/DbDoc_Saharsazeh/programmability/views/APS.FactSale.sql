



/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 11/21/2017 9:38:03 AM
 ************************************************************/


CREATE   VIEW [APS].[FactSale]
AS
    SELECT i.InvoiceID ,
           i.FinancialPeriodID ,
           i.BranchID ,
           i.BaseDocument ,
           i.CustomerID ,
           i.AddressID ,
           i.[Date] ,
           i.CurrencyID ,
           i.CurrencyRate ,
           i.SaleAgentID ,
           0 AS [Percentage] ,
           0 AS PercentageInBaseCurrency ,
           i.[SaleInvoiceStatus] ,
           i.SaleTypeID ,
           ii.SaleModelID ,
           ii.StuffID ,
           ii.MainQuantity ,
           ii.SubQuantity ,
           ii.Fee ,
           ii.Price ,
           ii.Discount ,
           ii.Tax ,
           ii.Duty ,
           ii.NetPrice ,
           ii.JustificationItemID ,
           ii.QuotationItemID ,
           ii.RemittanceItemID ,
           ii.OutgoingItemId ,
           ii.ContractSubjectID ,
           0 as ConfirmStatementID ,
           ii.SaleItemID ,
           ii.Fee * CASE c.IsBaseCurrencyBasis
                         WHEN 0 THEN i.CurrencyRate
                         ELSE 1 / i.CurrencyRate
                    END / c.ExchangeUnit AS FeeInBaseCurrency ,
           ii.Price * CASE c.IsBaseCurrencyBasis
                           WHEN 0 THEN i.CurrencyRate
                           ELSE 1 / i.CurrencyRate
                      END / c.ExchangeUnit AS PriceInBaseCurrency ,
           ii.Discount * CASE c.IsBaseCurrencyBasis
                              WHEN 0 THEN i.CurrencyRate
                              ELSE 1 / i.CurrencyRate
                         END / c.ExchangeUnit AS DiscountInBaseCurrency ,
           ii.Tax * CASE c.IsBaseCurrencyBasis
                         WHEN 0 THEN i.CurrencyRate
                         ELSE 1 / i.CurrencyRate
                    END / c.ExchangeUnit AS TaxInBaseCurrency ,
           ii.Duty * CASE c.IsBaseCurrencyBasis
                          WHEN 0 THEN i.CurrencyRate
                          ELSE 1 / i.CurrencyRate
                     END / c.ExchangeUnit AS DutyInBaseCurrency ,
           ii.NetPrice * CASE c.IsBaseCurrencyBasis
                              WHEN 0 THEN i.CurrencyRate
                              ELSE 1 / i.CurrencyRate
                         END / c.ExchangeUnit AS NetPriceInBaseCurrency ,
           ii.ReceptionID ,
           ii.AllocationSharingAmount ,
           1 AS InvoiceMultiplicy ,
           1 AS SaleDocument ,
           dd.DateId
    FROM   SLE.InvoiceItem AS ii
           INNER JOIN SLE.Invoice AS i ON i.InvoiceID = ii.InvoiceID
           LEFT JOIN SLE.SaleAgent sa on sa.SaleAgentID = i.SaleAgentID
           INNER JOIN CFG.DimDate AS dd ON dd.[Date] = i.[Date]
           INNER JOIN CFG.Currency AS c ON c.CurrencyID = i.CurrencyID
    UNION
    SELECT i.ReturnedSaleInvoiceID ,
           i.FinancialPeriodID ,
           i.BranchID ,
           i.BaseDocument ,
           i.CustomerID ,
           NULL ,
           i.[Date] ,
           i.CurrencyID ,
           i.CurrencyRate ,
           NULL AS SaleAgentID ,
           0 AS [Percentage] ,
           0 AS PercentageInBaseCurrency ,
           i.[Status] ,
           i.SaleTypeID ,
           ii.SaleModelID ,
           ii.StuffID ,
           ii.MainQuantity ,
           ii.SubQuantity ,
           ii.Fee ,
           ii.Price ,
           ii.Discount ,
           ii.Tax ,
           ii.Duty ,
           ii.NetPrice ,
           0 ,
           0 ,
           0 ,
           0 ,
           0 ,
           0 ,
           0 ,
           ii.Fee * CASE c.IsBaseCurrencyBasis
                         WHEN 0 THEN i.CurrencyRate
                         ELSE 1 / i.CurrencyRate
                    END / c.ExchangeUnit AS FeeInBaseCurrency ,
           ii.Price * CASE c.IsBaseCurrencyBasis
                           WHEN 0 THEN i.CurrencyRate
                           ELSE 1 / i.CurrencyRate
                      END / c.ExchangeUnit AS PriceInBaseCurrency ,
           ii.Discount * CASE c.IsBaseCurrencyBasis
                              WHEN 0 THEN i.CurrencyRate
                              ELSE 1 / i.CurrencyRate
                         END / c.ExchangeUnit AS DiscountInBaseCurrency ,
           ii.Tax * CASE c.IsBaseCurrencyBasis
                         WHEN 0 THEN i.CurrencyRate
                         ELSE 1 / i.CurrencyRate
                    END / c.ExchangeUnit AS TaxInBaseCurrency ,
           ii.Duty * CASE c.IsBaseCurrencyBasis
                          WHEN 0 THEN i.CurrencyRate
                          ELSE 1 / i.CurrencyRate
                     END / c.ExchangeUnit AS DutyInBaseCurrency ,
           ii.NetPrice * CASE c.IsBaseCurrencyBasis
                              WHEN 0 THEN i.CurrencyRate
                              ELSE 1 / i.CurrencyRate
                         END / c.ExchangeUnit AS NetPriceInBaseCurrency ,
           0 ,
           0 ,
           -1 AS InvoiceMultiplicy ,
           2 ,
           dd.DateId
    FROM   SLE.ReturnedSaleInvoice AS i
           INNER JOIN SLE.ReturnedSaleInvoiceItem AS ii ON i.ReturnedSaleInvoiceID = ii.ReturnedSaleInvoiceID
           INNER JOIN CFG.DimDate AS dd ON dd.[Date] = i.[Date]
           INNER JOIN CFG.Currency AS c ON c.CurrencyID = i.CurrencyID;


