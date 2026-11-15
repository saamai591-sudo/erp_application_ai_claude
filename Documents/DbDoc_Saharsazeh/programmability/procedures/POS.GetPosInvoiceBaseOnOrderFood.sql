

CREATE   PROC [POS].[GetPosInvoiceBaseOnOrderFood]
(@orderFoodId INT)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @date DATETIME,
            @StateShiftID INT,
            @CustomerGroupID INT,
            @PrecisionCount SMALLINT,
            @Culture NVARCHAR(5),
            @CultureNo TINYINT;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    SELECT @PrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = -1;

    SELECT fp.FinancialPeriodID,
           0 AS Number,
           ofo.[Date],
           ofo.StationShiftID AS StateShiftId,
           s2.StationID AS StationId,
           s2.StockID AS StockId,
           s2.PartyID AS CustomerId,
           CASE
               WHEN ofo.[Type] = 1 THEN
                   rt.Title
               ELSE
                   CAST(s.Number AS NVARCHAR(255))
           END AS Title,
           CAST(0 AS BIT) AS IsReturnInvoice,
           CAST(1 AS TINYINT) AS [Status],
           CAST(1 AS BIT) AS IsNotInFlow,
           CAST(1 AS BIT) AS IsOrderBase
    INTO #header
    FROM POS.OrderFood AS ofo
        JOIN POS.StationShift AS ss
            ON ss.StationShiftID = ofo.StationShiftID
        JOIN POS.Station AS s2
            ON s2.StationID = ss.StationID
        LEFT JOIN CFG.FinancialPeriod AS fp
            ON ofo.Date
               BETWEEN fp.StartDate AND fp.EndDate
        LEFT JOIN POS.RestaurantTable AS rt
            ON rt.RestaurantTableID = ofo.RestaurantTableID
        LEFT JOIN POS.Subscription AS s
            ON s.SubscriptionID = ofo.SubscriptionID
    WHERE ofo.OrderFoodID = @orderFoodId;

    SELECT @date = h.[Date],
           @StateShiftID = h.StateShiftId,
           @CustomerGroupID = p.CustomerGroupID
    FROM #header AS h
        JOIN CFG.Party AS p
            ON p.PartyID = h.CustomerId;


    DECLARE @InvoiceItemTable TABLE
    (
        PosInvoiceItemID INT,
        OrderFoodItemID INT,
        RowIndex INT,
        SaleModelId INT,
        StuffID INT,
        MainQuantity DECIMAL(30, 4),
        SubQuantity DECIMAL(30, 4),
        Fee DECIMAL(30, 4),
        Price DECIMAL(30, 4),
        Discount DECIMAL(30, 4)
    );

    INSERT INTO @InvoiceItemTable
    (
        PosInvoiceItemID,
        OrderFoodItemID,
        RowIndex,
        SaleModelId,
        StuffID,
        MainQuantity,
        SubQuantity,
        Fee,
        Price,
        Discount
    )
    SELECT CAST(ROW_NUMBER() OVER (ORDER BY ofi.OrderFoodItemID) AS INT) AS PosInvoiceItemID,
           ofi.OrderFoodItemID,
           CAST(ROW_NUMBER() OVER (ORDER BY ofi.OrderFoodItemID) AS INT) RowIndex,
           (
               SELECT TOP 1
                      ssm.SaleModelID
               FROM POS.StationSaleModel AS ssm
               WHERE ssm.StationID = ss.StationID
                     AND ssm.IsDefault = 1
           ) AS SaleModelID,
           ofi.StuffID,
           ofi.MainQuantity,
           ofi.SubQuantity,
           0 Fee,
           0 Price,
           0 Discount
    FROM POS.OrderFoodItem AS ofi
        JOIN POS.OrderFood AS ofo
            ON ofo.OrderFoodID = ofi.OrderFoodID
        JOIN POS.StationShift AS ss
            ON ss.StationShiftID = ofo.StationShiftID
    WHERE ofi.OrderFoodID = @orderFoodId;

    ---------------------------------------------------
    DECLARE @PosInvoiceItemId INT,
            @Stuff NVARCHAR(50),
            @SaleModel VARCHAR(80),
            @MainQuantity NVARCHAR(50),
            @DiscountGroupID INT;


    DECLARE vendor_cursor CURSOR FOR
    SELECT iit.PosInvoiceItemID,
           iit.StuffID,
           iit.SaleModelId,
           iit.MainQuantity,
           sd.DiscountGroupID
    FROM @InvoiceItemTable AS iit
        JOIN STF.[Stuff] AS s
            ON s.StuffID = iit.StuffID
        JOIN STF.StuffDetail AS sd
            ON sd.StuffID = s.StuffID;

    OPEN vendor_cursor;

    FETCH NEXT FROM vendor_cursor
    INTO @PosInvoiceItemId,
         @Stuff,
         @SaleModel,
         @MainQuantity,
         @DiscountGroupID;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @Fee DECIMAL(18, 0),
                @itemPrice DECIMAL(30, 4),
                @calculatedDiscount DECIMAL(30, 4),
                @IsAppropriateFeeEditable bit

        EXEC SLE.FindAppropriateFee @TraceObject = NULL,   -- nvarchar(max)
                                    @Stuff = @Stuff,               -- int
                                    @SaleModel = @SaleModel,       -- int
                                    @Currency = -1,         -- int
                                    @Date = @Date,                 -- date
                                    @EngName = 'PosInvoice',           -- nvarchar(255)
                                    @Fee = @Fee OUTPUT,            -- decimal(18, 0)
                                    @IsAppropriateFeeEditable = @IsAppropriateFeeEditable OUTPUT,
                                    @CreationDate = NULL; -- bit


        IF @Fee IS NULL
            SET @Fee = 0;
        SET @itemPrice = @Fee * @MainQuantity;

        DECLARE @Rate DECIMAL(5, 2),
                @Price DECIMAL(18, 4);

        EXEC SLE.CalculateItemLevelDiscountRate @CustomerGroup = @CustomerGroupID, -- int
                                                @SaleModel = @SaleModel,           -- int
                                                @StuffID = @Stuff,                 -- int
                                                @Date = @date,                     -- date
                                                @Rate = @Rate OUTPUT,              -- decimal(5, 2)
                                                @Price = @Price OUTPUT;            -- decimal(18, 4)



        SET @calculatedDiscount = CASE
                                      WHEN @Price IS NOT NULL
                                           AND @Price <> 0 THEN
                                          @Price
                                      WHEN @Rate IS NOT NULL
                                           AND @Rate <> 0 THEN
                                          ROUND(@Rate * @itemPrice / 100, @PrecisionCount)
                                      ELSE
                                          0
                                  END;

        UPDATE @InvoiceItemTable
        SET Fee = @Fee,
            Price = ROUND(@itemPrice, @PrecisionCount),
            Discount = @calculatedDiscount
        WHERE PosInvoiceItemID = @PosInvoiceItemId;

        FETCH NEXT FROM vendor_cursor
        INTO @PosInvoiceItemId,
             @Stuff,
             @SaleModel,
             @MainQuantity,
             @DiscountGroupID;
    END;
    CLOSE vendor_cursor;
    DEALLOCATE vendor_cursor;

    SELECT h.FinancialPeriodID,
           h.Number,
           h.[Date],
           h.StateShiftId,
           h.StationId,
           h.StockId,
           h.CustomerId,
           h.Title,
           h.IsReturnInvoice,
           h.[Status],
           h.IsNotInFlow,
           h.IsOrderBase
    FROM #header AS h;

    SELECT 0 AS PosInvoiceItemID,
           iit.OrderFoodItemID AS OrderFoodItemId,
           iit.RowIndex,
           iit.SaleModelId,
           CASE @CultureNo
               WHEN 1 THEN
                   sm.Title
               WHEN 2 THEN
                   sm.Title2
           END AS SaleModelTitle,
           iit.StuffID,
           iit.StuffID AS BarCodeID,
           iit.StuffID AS IranCodeID,
           sd.Barcode AS BarCode,
           sd.IranCode,
           s.Code AS StuffCode,
           CASE @CultureNo
               WHEN 1 THEN
                   s.Title
               WHEN 2 THEN
                   s.Title2
           END AS StuffTitle,
           CASE @CultureNo
               WHEN 1 THEN
                   mu.Title
               WHEN 2 THEN
                   mu.Title2
           END AS MainUnit,
           iit.MainQuantity,
           iit.SubQuantity,
           iit.Fee,
           iit.Price,
           iit.Discount
    FROM @InvoiceItemTable AS iit
        LEFT JOIN STF.[Stuff] AS s
            ON s.StuffID = iit.StuffID
        JOIN STF.StuffDetail AS sd
            ON sd.StuffID = s.StuffID
        JOIN STF.MeasureUnit AS mu
            ON mu.MeasureUnitID = s.MainMeasureUnitID
        LEFT JOIN SLE.SaleModel AS sm
            ON sm.SaleModelID = iit.SaleModelId;
END;
