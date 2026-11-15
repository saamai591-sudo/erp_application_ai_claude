
---------------------------------------------------------
CREATE   PROC [STF].spStuffDetailInsert
    @StuffID INT ,
    @StuffAccountGroupID INT ,
    @Barcode NVARCHAR(50) ,
    @IranCode NVARCHAR(50) ,
    @Saleable BIT ,
    @MeasureSubUnitID INT ,
    @ConvertRatio DECIMAL(10, 3) ,
    @IsStable BIT ,
    @MinContorol BIT ,
    @ControlType TINYINT ,
    @MinValue DECIMAL(30, 4) ,
    @MaxValue DECIMAL(30, 4) ,
    @SalesGroupID INT ,
    @CommissionGroupID INT ,
    @BuyGroupID INT ,
    @DiscountGroupID INT ,
    @OrderPoint DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @DamageStuffID INT ,
    @MainToSpoilageConvertRatio DECIMAL(20, 10) ,
    @SlID INT ,
    @TechnicalCode NVARCHAR(50)

--WITH ENCRYPTION 
AS
    IF EXISTS (   SELECT 1
                  FROM   STF.StuffDetail AS sd
                  WHERE  sd.Barcode = @Barcode )
        BEGIN
            RAISERROR(N'بارکد تکراری می باشد', 16, 12);
            RETURN;
        END;

    IF @MeasureSubUnitID IS NOT NULL
       AND @MeasureSubUnitID = (   SELECT s.MainMeasureUnitID
                                   FROM   STF.[Stuff] s
                                   WHERE  s.StuffID = @StuffID )
        BEGIN
            RAISERROR(N'واحد اصلی و فرعی نباید یکسان باشند', 16, 12);
            RETURN;
        END;
    IF @MeasureSubUnitID IS NOT NULL
       AND @ConvertRatio IS NULL
        BEGIN
            RAISERROR(N'نسبت تبدیل الزامی می باشد', 16, 12);
            RETURN;
        END;

    IF @IranCode = ''
        SET @IranCode = NULL;

    IF @Barcode = ''
        SET @Barcode = NULL;

    INSERT INTO [STF].[StuffDetail] ( [StuffID] ,
                                      [StuffAccountGroupID] ,
                                      [Barcode] ,
                                      [IranCode] ,
                                      [Saleable] ,
                                      [MeasureSubUnitID] ,
                                      [ConvertRatio] ,
                                      [IsStable] ,
                                      [MinContorol] ,
                                      [ControlType] ,
                                      [MinValue] ,
                                      [MaxValue] ,
                                      [SalesGroupID] ,
                                      [CommissionGroupID] ,
                                      [BuyGroupID] ,
                                      [DiscountGroupID] ,
                                      [OrderPoint] ,
                                      [Version] ,
                                      [Creator] ,
                                      [CreationDate] ,
                                      [LastEditor] ,
                                      [LastEditionDate] ,
                                      [DamageStuffID] ,
                                      [MainToSpoilageConvertRatio] ,
                                      [SlID] ,
                                      [TechnicalCode] )
                SELECT @StuffID ,
                       @StuffAccountGroupID ,
                       @Barcode ,
                       @IranCode ,
                       @Saleable ,
                       @MeasureSubUnitID ,
                       @ConvertRatio ,
                       @IsStable ,
                       @MinContorol ,
                       @ControlType ,
                       @MinValue ,
                       @MaxValue ,
                       @SalesGroupID ,
                       @CommissionGroupID ,
                       @BuyGroupID ,
                       @DiscountGroupID ,
                       @OrderPoint ,
                       0 ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       @DamageStuffID ,
                       @MainToSpoilageConvertRatio ,
                       @SlID ,
                       @TechnicalCode;

    UPDATE STF.[Stuff]
    SET    FixedAssetConversion = 1
    FROM   STF.[Stuff]
           INNER JOIN STF.StuffDetail AS sd ON sd.StuffID = STF.[Stuff].StuffID
		   INNER JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
    WHERE  sd.StuffID = @StuffID
           AND SAG.StuffDetailType = 4;

    -- Begin Return Select <- do not remove
    SELECT [StuffID], [Version]
    FROM   [STF].[StuffDetail] SD
    WHERE  [StuffID] = @StuffID;
    -- End Return Select <- do not remove
