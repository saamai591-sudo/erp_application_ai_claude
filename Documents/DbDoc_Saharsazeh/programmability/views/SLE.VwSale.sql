
------------------------------------------------
CREATE   VIEW [SLE].VwSale

--WITH ENCRYPTION 
AS
SELECT 'Sale' [TYPE],
       i.[Date],
       i.FinancialPeriodID,
       fp.Title                           FinancialPeriodTitle,
       i.CustomerID,
       dd.PersianMonthNumberOfYear [Month],
       dd.PersianMonthName                ShamsiMonthName,
       dd.PersianCalendarYear,
       dd.PersianSeasonName,
       dd.PersianMonthName + ' ' + CAST(dd.PersianCalendarYear AS VARCHAR(10)) AS ShamsiYearMonth,
       i.Number                           InvoiceNumber,
       i.Date                             InvoiceDate,
       i.[SaleInvoiceStatus],
       sd.SalesGroupID,
       d.code                             DlCode,
       ISNULL(p.Title, '') + ' ' + ISNULL(p.LastName, '') CustomerName,
       va.country,
       va.province,
       va.county,
       va.city,
       va.titleAddress,
       va.ZipCode,
       p2.Phone,
       sm.Code                            SaleModelCode,
       sm.Title                           SaleModelTitle,
       g.Code                             GroupCode,
       g.Title                            GroupTitle,
       s.StuffID,
       s.Code                             StuffCode,
       s.Title                            StuffTitle,
       b.Code                             BranchCode,
       b.Title                            BranchTitle,
       ii.MainQuantity,
       m1.Title                           MainMeasureUnit,
       ii.SubQuantity,
       m2.Title                           SubMeasureUnit,
       ii.Price                           sale,
       0                                  returned,
       - ii.Discount                      Discount,
       [STF].[StuffGroupFullCode](S.StuffGroupID) StuffGroupCode,
       sg.Title                           StuffGroupTitle,
       c.Title,
       ROUND(
           ii.Price *
           CASE c.IsBaseCurrencyBasis
                WHEN 0 THEN i.CurrencyRate
                ELSE 1 / i.CurrencyRate
           END
           / c.ExchangeUnit,
           cfg.GetBaseCurrencyPrecision()
       )                                  SaleInBaseCurrency,
       0                                  ReturnedInBaseCurrency,
       - ROUND(
           ii.Discount * CASE c.IsBaseCurrencyBasis
                WHEN 0 THEN i.CurrencyRate
                ELSE 1 / i.CurrencyRate
           END/ c.ExchangeUnit,
           cfg.GetBaseCurrencyPrecision()
       )                                  DiscountInBaseCurrency
FROM   SLE.InvoiceItem                 AS ii
       INNER JOIN SLE.Invoice          AS i
            ON  i.InvoiceID = ii.InvoiceID
       INNER JOIN cfg.Currency c
            ON  c.CurrencyID = i.CurrencyID
       INNER JOIN cfg.DimDate          AS dd
            ON  dd.[Date] = i.[Date]
       INNER JOIN cfg.FinancialPeriod  AS fp
            ON  fp.FinancialPeriodID = i.FinancialPeriodID
       INNER JOIN CFG.Branch           AS b
            ON  b.BranchID = i.BranchID
       INNER JOIN CFG.Party            AS p
            ON  p.PartyID = i.CustomerID
       INNER JOIN stf.[Stuff] s
            ON  ii.StuffID = s.StuffID
       INNER JOIN stf.MeasureUnit M1
            ON  m1.MeasureUnitID = s.MainMeasureUnitID
       INNER JOIN stf.StuffDetail sd
            ON  sd.StuffID = s.StuffID
       LEFT JOIN stf.MeasureUnit m2
            ON  m2.MeasureUnitID = sd.MeasureSubUnitID
       LEFT JOIN cfg.VwAddress va
            ON  p.PartyID = va.PartyID
            AND va.IsMain = 1
       LEFT JOIN cfg.Phone p2
            ON  p.PartyID = p2.PartyID
            AND p2.IsMain = 1
       LEFT JOIN sle.SaleModel sm
            ON  ii.SaleModelID = sm.SaleModelID
       LEFT JOIN cfg.[Group] g
            ON  sd.SalesGroupID = g.GroupID
            AND g.GroupType = 2
       LEFT JOIN acc.DL d
            ON  p.DlID = d.DLID
       LEFT JOIN STF.StuffGroup SG
            ON  SG.StuffGroupID = S.StuffGroupID
WHERE  i.SaleInvoiceStatus <> 5
UNION
 ALL

SELECT 'ReturnedSale' [TYPE],
       i.[Date],
       i.FinancialPeriodID,
       fp.Title                        AS FinancialPeriodTitle,
       i.CustomerID,
       dd.PersianMonthNumberOfYear [Month],
       dd.PersianMonthName                ShamsiMonthName,
       dd.PersianCalendarYear,
       dd.PersianSeasonName,
       dd.PersianMonthName + ' ' + CAST(dd.PersianCalendarYear AS VARCHAR(10)) AS ShamsiYearMonth,
       i.Number,
       i.Date,
       i.[Status],
       sd.SalesGroupID,
       d.code                          AS DlCode,
       ISNULL(p.Title, '') + ' ' + ISNULL(p.LastName, '') CustomerName,
       va.country,
       va.province,
       va.county,
       va.city,
       va.titleAddress,
       va.ZipCode,
       p2.Phone,
       sm.Code                            SaleModelCode,
       sm.Title                           SaleModelTitle,
       g.Code                             GroupCode,
       g.Title                            GroupTitle,
       s.StuffID,
       s.Code                             StuffCode,
       s.Title                            StuffTitle,
       b.Code                             BranchCode,
       b.Title                            BranchTitle,
       ii.MainQuantity,
       m1.Title                           MainMeasureUnit,
       ii.SubQuantity,
       m2.Title                           SubMeasureUnit,
       0                               AS sale,
       -ii.Price                       AS returned,
       ii.Discount                     AS Discount,
       [STF].[StuffGroupFullCode](S.StuffGroupID) StuffGroupCode,
       sg.Title                           StuffGroupTitle,
       c.Title,
       0                                  SaleInBaseCurrency,
       -ROUND(
           ii.Price * CASE c.IsBaseCurrencyBasis
                WHEN 0 THEN i.CurrencyRate
                ELSE 1 / i.CurrencyRate
           END / c.ExchangeUnit,
           cfg.GetBaseCurrencyPrecision()
       )                                  ReturnedInBaseCurrency,
       ROUND(
           ii.Discount * CASE c.IsBaseCurrencyBasis
                WHEN 0 THEN i.CurrencyRate
                ELSE 1 / i.CurrencyRate
           END / c.ExchangeUnit,
           cfg.GetBaseCurrencyPrecision()
       )                                  DiscountInBaseCurrency
FROM   SLE.ReturnedSaleInvoiceItem     AS ii
       INNER JOIN SLE.ReturnedSaleInvoice AS i
            ON  i.ReturnedSaleInvoiceID = ii.ReturnedSaleInvoiceID
       INNER JOIN cfg.Currency c
            ON  c.CurrencyID = i.CurrencyID
       INNER JOIN cfg.DimDate          AS dd
            ON  dd.[Date] = i.[Date]
       INNER JOIN cfg.FinancialPeriod  AS fp
            ON  fp.FinancialPeriodID = i.FinancialPeriodID
       INNER JOIN CFG.Branch           AS b
            ON  b.BranchID = i.BranchID
       INNER JOIN CFG.Party            AS p
            ON  p.PartyID = i.CustomerID
       INNER JOIN stf.[Stuff] s
            ON  ii.StuffID = s.StuffID
       INNER JOIN stf.MeasureUnit M1
            ON  m1.MeasureUnitID = s.MainMeasureUnitID
       INNER JOIN stf.StuffDetail sd
            ON  sd.StuffID = s.StuffID
       LEFT JOIN stf.MeasureUnit m2
            ON  m2.MeasureUnitID = sd.MeasureSubUnitID
       LEFT JOIN cfg.VwAddress va
            ON  p.PartyID = va.PartyID
            AND va.IsMain = 1
       LEFT JOIN cfg.Phone p2
            ON  p.PartyID = p2.PartyID
            AND p2.IsMain = 1
       LEFT JOIN sle.SaleModel sm
            ON  ii.SaleModelID = sm.SaleModelID
       LEFT JOIN cfg.[Group] g
            ON  sd.SalesGroupID = g.GroupID
            AND g.GroupType = 2
       LEFT JOIN acc.DL d
            ON  p.DlID = d.DLID
       LEFT JOIN STF.StuffGroup SG
            ON  SG.StuffGroupID = S.StuffGroupID
              
