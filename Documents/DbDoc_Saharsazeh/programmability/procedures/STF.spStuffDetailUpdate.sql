
CREATE    PROC [STF].[spStuffDetailUpdate]
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
    @Version INT ,
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
    SET NOCOUNT ON;
	
    IF @Version <> (   SELECT [Version]
                       FROM   [STF].[StuffDetail]
                       WHERE  [StuffID] = @StuffID )
        RAISERROR('Version mismatch...', 16, 10);

    IF @IranCode = ''
        SET @IranCode = NULL;

    IF @Barcode = ''
        SET @Barcode = NULL;

    DECLARE @StuffStuffAccountGroupIDHasFlow BIT ,
            @oldStuffAccountGroupID INT;

    SELECT @StuffStuffAccountGroupIDHasFlow = STC.StuffStuffAccountGroupIDHasFlow(s.StuffID) ,
           @oldStuffAccountGroupID = s.StuffAccountGroupID
    FROM   STF.[StuffDetail] AS s
    WHERE  s.StuffID = @StuffID;

	IF @oldStuffAccountGroupID <> @StuffAccountGroupID AND @StuffStuffAccountGroupIDHasFlow = 1
	BEGIN
	    RAISERROR('StuffManager.StuffAccountGroupCannotChange', 16, 12);
		RETURN 
	END
	
    UPDATE [STF].[StuffDetail]
    SET    [StuffID] = @StuffID ,
           [StuffAccountGroupID] = @StuffAccountGroupID ,
           [Barcode] = @Barcode ,
           [IranCode] = @IranCode ,
           [Saleable] = @Saleable ,
           [MeasureSubUnitID] = @MeasureSubUnitID ,
           [ConvertRatio] = @ConvertRatio ,
           [IsStable] = @IsStable ,
           [MinContorol] = @MinContorol ,
           [ControlType] = @ControlType ,
           [MinValue] = @MinValue ,
           [MaxValue] = @MaxValue ,
           [SalesGroupID] = @SalesGroupID ,
           [CommissionGroupID] = @CommissionGroupID ,
           [BuyGroupID] = @BuyGroupID ,
           [DiscountGroupID] = @DiscountGroupID ,
           [OrderPoint] = @OrderPoint ,
           [Version] = @Version + 1 ,
           [LastEditor] = @LastEditor ,
           [LastEditionDate] = @LastEditionDate ,
           [DamageStuffID] = @DamageStuffID ,
           [MainToSpoilageConvertRatio] = @MainToSpoilageConvertRatio ,
           [SlID] = @SlID ,
           [TechnicalCode] = @TechnicalCode
    WHERE  [StuffID] = @StuffID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
    FROM   [STF].[StuffDetail] SD
    WHERE  [StuffID] = @StuffID;
-- End Return Select <- do not remove
