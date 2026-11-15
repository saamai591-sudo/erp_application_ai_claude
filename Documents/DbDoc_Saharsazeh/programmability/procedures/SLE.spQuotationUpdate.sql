CREATE      PROC [SLE].[spQuotationUpdate]
    @QuotationID INT ,
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @ExpirationDate DATETIME ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @Status TINYINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Non_Received DECIMAL(30, 4),
	@SaleAreaId int
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

	if @SaleAreaID is null
	    set @SaleAreaID = -1

        IF @Version <> (   SELECT [Version]
                           FROM   [SLE].[Quotation]
                           WHERE  [QuotationID] = @QuotationID )
            RAISERROR('Version mismatch...', 16, 10);

        SET @Non_Received = @TotalNetPrice;

        DECLARE @StartNum INT = NULL ,
                @EndNum INT = NULL ,
                @Branch BIT = 0 ,
                @ResetType BIT = 0 ,
                @DocumentNumID INT ,
                @Message NVARCHAR(MAX),
			@ResetSaleArea bit = 0

        SELECT @StartNum = StartNum ,
               @EndNum = EndNum ,
               @DocumentNumID = DocumentNumID
        FROM   CFG.DocumentNum
        WHERE  DocumentNumTypeID = 13
               AND FinancialPeriodID = @FinancialPeriodID;

        IF EXISTS (   SELECT *
                      FROM   CFG.DocumentNumResetNumberBase
                      WHERE  DocumentNumID = @DocumentNumID
                             AND DocumentNumResetNumberBaseTypeID = 5 )
            BEGIN
                SET @Branch = 1;
            END;

        IF EXISTS (   SELECT *
                      FROM   CFG.DocumentNumResetNumberBase
                      WHERE  DocumentNumID = @DocumentNumID
                             AND DocumentNumResetNumberBaseTypeID = 6 )
            BEGIN
                SET @ResetType = 1;
            END;

IF EXISTS
(
    SELECT 1
    FROM CFG.DocumentNumResetNumberBase a
	join [CFG].[DocumentNumResetNumberBaseType] b
		on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
    WHERE DocumentNumID = @DocumentNumID
			AND b.EngName = 'SaleArea'
)
BEGIN
    SET @ResetSaleArea = 1;
END;

        IF (   @Number = 0
               OR @Number IS NULL )
            SET @Number = ISNULL(
                          (   SELECT MAX(Number) + 1
                              FROM   [SLE].[Quotation]
                              WHERE  FinancialPeriodID = @FinancialPeriodID
                                     AND (   @Branch = 0
                                             OR BranchID = @BranchID )
                                     AND (   @ResetType = 0
                                             OR [SaleTypeID] = @SaleTypeId )
                            AND
                            (
                                @ResetSaleArea = 0
                                OR [SaleAreaID] = @SaleAreaId
                            )												 
											 ) ,
                          @StartNum);

        IF (   @Number >= @StartNum
               AND (   @EndNum IS NULL
                       OR @Number <= @EndNum ))
            BEGIN
                UPDATE [SLE].[Quotation]
                SET    [BaseDocument] = @BaseDocument ,
                       [SaleTypeID] = @SaleTypeId ,
                       [BranchID] = @BranchID ,
                       [CustomerID] = @CustomerID ,
                       [AddressID] = @AddressID ,
                       [Number] = @Number ,
                       [Date] = @Date ,
                       [ExpirationDate] = @ExpirationDate ,
                       [CurrencyID] = @CurrencyID ,
                       [TotalPrice] = @TotalPrice ,
                       [TotalDiscount] = @TotalDiscount ,
                       [TotalNetPrice] = @TotalNetPrice ,
                       [TotalTax] = @TotalTax ,
                       [TotalDuty] = @TotalDuty ,
                       [Status] = @Status ,
                       [Version] = @Version + 1 ,
                       [LastEditor] = @LastEditor ,
                       [LastEditionDate] = @LastEditionDate ,
                       [Non_Received] = @Non_Received,
					   [SaleAreaId] = @SaleAreaId
                WHERE  [QuotationID] = @QuotationID;

                -- Begin Return Select <- do not remove
                SELECT  [Version]  ,
                       [Number]
                FROM   [SLE].[Quotation]
                WHERE  [QuotationID] = @QuotationID;
            -- End Return Select <- do not remove
            END;
        ELSE
            BEGIN
                SELECT @Message = 'InvalidNumberRange'
                RAISERROR(@Message, 16, 12);
            END;
