
----------------Start of #8066
CREATE     PROC [SLE].spQuotationInsert
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
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Non_Received DECIMAL(18, 4),
	@SaleAreaId int
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

	if @SaleAreaID is null
	set @SaleAreaID = -1

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
            INSERT INTO [SLE].[Quotation] ( [FinancialPeriodID] ,
                                            [BaseDocument] ,
                                            [SaleTypeID] ,
                                            [BranchID] ,
                                            [CustomerID] ,
                                            [AddressID] ,
                                            [Number] ,
                                            [Date] ,
                                            [ExpirationDate] ,
                                            [CurrencyID] ,
                                            [TotalPrice] ,
                                            [TotalDiscount] ,
                                            [TotalNetPrice] ,
                                            [TotalTax] ,
                                            [TotalDuty] ,
                                            [Status] ,
                                            [Version] ,
                                            [Creator] ,
                                            [CreationDate] ,
                                            [LastEditor] ,
                                            [LastEditionDate] ,
                                            [Non_Received],
											[SaleAreaId])
                        SELECT @FinancialPeriodID ,
                               @BaseDocument ,
                               @SaleTypeId ,
                               @BranchID ,
                               @CustomerID ,
                               @AddressID ,
                               @Number ,
                               @Date ,
                               @ExpirationDate ,
                               @CurrencyID ,
                               @TotalPrice ,
                               @TotalDiscount ,
                               @TotalNetPrice ,
                               @TotalTax ,
                               @TotalDuty ,
                               @Status ,
                               0 ,
                               @Creator ,
                               @CreationDate ,
                               @LastEditor ,
                               @LastEditionDate ,
                               @Non_Received,
							   @SaleAreaId;

            -- Begin Return Select <- do not remove
            SELECT [QuotationID] ,
                   [Version] ,
                   [Number] 
            FROM   [SLE].[Quotation]
            WHERE  [QuotationID] = SCOPE_IDENTITY();
            -- End Return Select <- do not remove
        END;
    ELSE
        BEGIN
            SELECT @Message = 'InvalidNumberRange'
            RAISERROR(@Message, 16, 12);
        END;
