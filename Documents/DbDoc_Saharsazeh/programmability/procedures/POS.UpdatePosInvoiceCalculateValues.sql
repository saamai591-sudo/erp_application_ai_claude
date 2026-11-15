
--------------------------------------------
CREATE   PROCEDURE POS.UpdatePosInvoiceCalculateValues
(@invoiceId INT)
AS
BEGIN

    DECLARE @PrecisionCount INT,
            @ExchangeUnit INT,
            @TaxRate DECIMAL(4, 2),
            @DutyRate DECIMAL(4, 2),
            @financialPeriodId INT,
            @stationId INT,
            @posinvoiceDate datetime,
            @stationExemptFromVat bit = 0;

    SELECT @PrecisionCount = c.PrecisionCount,
           @ExchangeUnit = c.ExchangeUnit
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;


    DECLARE @decimalCountPow INT = POWER(10, @PrecisionCount);

    SELECT 
            @financialPeriodId = pi.FinancialPeriodID, 
            @stationId = ss.StationID,
            @posinvoiceDate = pi.Date
    FROM POS.PosInvoice AS pi
    join pos.StationShift ss on ss.StationShiftID= pi.StateShiftID
    WHERE pi.PosInvoiceID = @invoiceId;

    SELECT @TaxRate = vr.TaxRate,
               @DutyRate = vr.DutyRate
        FROM ACC.VatRate AS vr
        WHERE vr.FinancialPeriodID = @financialPeriodId;

    ---  taxrate here will be changed by company and station.ExemptFromVat
    IF (@stationId IS NOT NULL)    
    BEGIN
        SELECT @stationExemptFromVat=ExemptFromVat FROM POS.Station
        WHERE StationID = @stationId

        IF(@stationExemptFromVat = 1)
        BEGIN
            SET @TaxRate = 0
            SET @DutyRate = 0
        END
        ELSE
        BEGIN        
            SELECT TOP 1 cvi.* INTO #CompanyVatItem FROM CFG.CompanyVatItem CVI 
            JOIN CFG.Company C ON C.CompanyID = CVI.CompanyID
            JOIN CFG.Branch B ON B.CompanyID = C.CompanyID
            JOIN POS.Station S ON S.BranchID = B.BranchID
        
            WHERE S.StationID = @stationId 
                    AND CVI.Date <= @posinvoiceDate
            ORDER BY CVI.Date  DESC

            IF (EXISTS (SELECT * FROM #CompanyVatItem))
            BEGIN
                SELECT TOP 1 @TaxRate = VatRate FROM #CompanyVatItem
                SET @DutyRate = 0
            END
        END

    END
    -------------------------

    IF @TaxRate IS NULL
        SET @TaxRate = 0;

    IF @DutyRate IS NULL
        SET @DutyRate = 0;

    UPDATE pii
    SET pii.Price = src.NewPrice,
        pii.Tax = src.NewTax,
        pii.Duty = src.NewDuty,
        pii.NetPrice = ROUND(src.NewPrice - pii.Discount + src.NewTax + src.NewDuty, @PrecisionCount)
    FROM POS.PosInvoiceItem AS pii
        JOIN
        (
            SELECT pii.PosInvoiceItemID,
                   pii.Price,
                   NewPrice =   FLOOR(pii.Fee * pii.MainQuantity * @decimalCountPow) / @decimalCountPow ,
                   NewTax = CASE
                                WHEN s.ExemptOfSellVat = 1 THEN
                                    0
                                WHEN s.TaxRate IS NOT NULL THEN
                                    CAST(FLOOR(((FLOOR(pii.Fee * pii.MainQuantity * @decimalCountPow) / @decimalCountPow) - pii.Discount)
                                               * (s.TaxRate / 100) * @decimalCountPow
                                              ) / @decimalCountPow AS DECIMAL(36, 10))
                                ELSE
                                    CAST(FLOOR(((FLOOR(pii.Fee * pii.MainQuantity * @decimalCountPow) / @decimalCountPow) - pii.Discount)
                                               * (@TaxRate / 100) * @decimalCountPow
                                              ) / @decimalCountPow AS DECIMAL(36, 10))
                            END,
                   NewDuty = CASE
                                 WHEN s.ExemptOfSellVat = 1 THEN
                                     0
                                 WHEN s.DutyRate IS NOT NULL THEN
                                     CAST(FLOOR(((FLOOR(pii.Fee * pii.MainQuantity * @decimalCountPow) / @decimalCountPow) - pii.Discount)
                                                * (s.DutyRate / 100) * @decimalCountPow
                                               ) / @decimalCountPow AS DECIMAL(36, 10))
                                 ELSE
                                     CAST(FLOOR(((FLOOR(pii.Fee * pii.MainQuantity * @decimalCountPow) / @decimalCountPow) - pii.Discount)
                                                * (@DutyRate / 100) * @decimalCountPow
                                               ) / @decimalCountPow AS DECIMAL(36, 10))
                             END,
                   pii.Tax,
                   pii.Duty
            FROM POS.PosInvoiceItem AS pii
                JOIN STF.VWStuff AS s ON s.StuffID = pii.StuffID
            WHERE pii.PosInvoiceID = @invoiceId
        ) AS src ON src.PosInvoiceItemID = pii.PosInvoiceItemID;

    UPDATE POS.PosInvoice
    SET TotalPrice =
        (
            SELECT SUM(Price)FROM POS.PosInvoiceItem WHERE PosInvoiceID = @invoiceId
        ),
        TotalDiscount =
        (
            SELECT SUM(Discount)
            FROM POS.PosInvoiceItem
            WHERE PosInvoiceID = @invoiceId
        ),
        TotalTax =
        (
            SELECT SUM(Tax)FROM POS.PosInvoiceItem WHERE PosInvoiceID = @invoiceId
        ),
        TotalDuty =
        (
            SELECT SUM(Duty)FROM POS.PosInvoiceItem WHERE PosInvoiceID = @invoiceId
        ),
        TotalNetPrice =
        (
            SELECT SUM(NetPrice)
            FROM POS.PosInvoiceItem
            WHERE PosInvoiceID = @invoiceId
        ) + RoundPrice,
        TotalNetPriceBeforeRound =
        (
            SELECT SUM(NetPrice)
            FROM POS.PosInvoiceItem
            WHERE PosInvoiceID = @invoiceId
        )
    WHERE PosInvoiceID = @invoiceId;
END;
