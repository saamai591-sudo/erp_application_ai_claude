CREATE      PROC [SLE].[spReturnedSaleJustificationUpdate]
    @ReturnedSaleJustificationID INT ,
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @CurrencyID INT ,
    @Number INT ,
    @Date DATETIME ,
    @Status TINYINT ,
    @Version INT ,
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

	if @SaleAreaID is null
	set @SaleAreaID = -1

    IF @Version <> ( SELECT [Version]
                     FROM   [SLE].[ReturnedSaleJustification]
                     WHERE  [ReturnedSaleJustificationID] = @ReturnedSaleJustificationID
                   )
        RAISERROR('Version mismatch...', 16 , 10);
		
    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Branch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @Message NVARCHAR(MAX);
			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = 22
            AND FinancialPeriodID = @FinancialPeriodID;

    IF EXISTS ( SELECT 1
                FROM    CFG.DocumentNumResetNumberBase
                WHERE   DocumentNumID = @DocumentNumID
                        AND DocumentNumResetNumberBaseTypeID = 5 )
        BEGIN
            SET @Branch = 1;
        END;
	
    IF EXISTS ( SELECT  1
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
            UPDATE  [SLE].[ReturnedSaleJustification]
            SET     [BaseDocument] = @BaseDocument ,
                    [SaleTypeID] = @SaleTypeId ,
                    [BranchID] = @BranchID ,
                    [CustomerID] = @CustomerID ,
                    [CurrencyID] = @CurrencyID ,
                    [Number] = @Number ,
                    [Date] = @Date ,
                    [Status] = @Status ,
                    [Version] = @Version + 1 ,
                    [LastEditor] = @LastEditor ,
                    [LastEditionDate] = @LastEditionDate ,
                    [TotalPrice] = @TotalPrice ,
                    [TotalDiscount] = @TotalDiscount ,
                    [TotalNetPrice] = @TotalNetPrice ,
                    [TotalDuty] = @TotalDuty ,
                    [TotalTax] = @TotalTax,
					[SaleAreaID] = @SaleAreaID
            WHERE   [ReturnedSaleJustificationID] = @ReturnedSaleJustificationID;
	
		-- Begin Return Select <- do not remove
            SELECT  [Version] ,
                    [Number]
            FROM    [SLE].[ReturnedSaleJustification]
            WHERE   [ReturnedSaleJustificationID] = @ReturnedSaleJustificationID;	
		-- End Return Select <- do not remove
    END;
    ELSE
    BEGIN
        RAISERROR('InvalidNumberRange',16,12);
    END;
