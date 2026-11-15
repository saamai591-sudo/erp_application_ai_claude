CREATE      PROC [SLE].[spReturnedSaleJustificationInsert]
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @Number INT ,
    @Date DATETIME ,
    @CurrencyID INT ,
    @Status TINYINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalNetPrice DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4),
	@SaleAreaID INT

--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 
    SET XACT_ABORT ON;  
    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Branch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @Message NVARCHAR(MAX);

	if @SaleAreaID is null
	set @SaleAreaID = -1

    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = 22
            AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS ( SELECT  *
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 5 )
        BEGIN
            SET @Branch = 1;
        END;
	
    IF EXISTS ( SELECT  *
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 6 )
        BEGIN
            SET @ResetType = 1;
        END;
	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [SLE].[ReturnedSaleJustification]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                                        AND ( @Branch = 0
                                              OR BranchID = @BranchID
                                            )
                                        AND ( @ResetType = 0
                                              OR [SaleTypeID] = @SaleTypeId
                                            )
                             ), @StartNum);
   
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN 
            INSERT  INTO [SLE].[ReturnedSaleJustification]
                    ( [FinancialPeriodID] ,
                      [BaseDocument] ,
                      [SaleTypeID] ,
                      [BranchID] ,
                      [CustomerID] ,
                      [Number] ,
                      [Date] ,
                      [Status] ,
                      [Version] ,
                      [Creator] ,
                      [CreationDate] ,
                      [LastEditor] ,
                      [LastEditionDate] ,
                      [CurrencyID] ,
                      [TotalPrice] ,
                      [TotalDiscount] ,
                      [TotalNetPrice] ,
                      [TotalTax] ,
                      [TotalDuty],
					  [SaleAreaID]
                    )
                    SELECT  @FinancialPeriodID ,
                            @BaseDocument ,
                            @SaleTypeId ,
                            @BranchID ,
                            @CustomerID ,
                            @Number ,
                            @Date ,
                            @Status ,
                            0 ,
                            @Creator ,
                            @CreationDate ,
                            @LastEditor ,
                            @LastEditionDate ,
                            @CurrencyID ,
                            @TotalPrice ,
                            @TotalDiscount ,
                            @TotalNetPrice ,
                            @TotalTax ,
                            @TotalDuty,
							@SaleAreaID;
	
	-- Begin Return Select <- do not remove
    SELECT  [ReturnedSaleJustificationID] ,
            [Version] ,
            [Number]
    FROM    [SLE].[ReturnedSaleJustification]
    WHERE   [ReturnedSaleJustificationID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
        END;
    ELSE
        BEGIN
            RAISERROR('InvalidNumberRange',16,12);	
        END;
