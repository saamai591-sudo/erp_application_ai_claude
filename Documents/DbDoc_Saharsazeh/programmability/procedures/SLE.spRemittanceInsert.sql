CREATE      PROC [SLE].[spRemittanceInsert]
    @FinancialPeriodID INT ,
    @BaseDocument TINYINT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @StockID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @DeadLine DATETIME ,
    @Status TINYINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaID int
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 
    SET XACT_ABORT ON;  

	if @SaleAreaID is null
	set @SaleAreaID = -1

    DECLARE @StartNum INT = NULL ,
        @EndNum INT = NULL ,
        @Branch BIT = 0 ,
        @ResetType BIT = 0 ,
        @DocumentNumID INT ,
        @Message NVARCHAR(MAX),
			@ResetSaleArea bit = 0
			
    SELECT  @StartNum = StartNum ,
            @EndNum = EndNum ,
            @DocumentNumID = DocumentNumID
    FROM    CFG.DocumentNum
    WHERE   DocumentNumTypeID = 14
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
	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [SLE].[Remittance]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                                        AND ( @Branch = 0
                                              OR BranchID = @BranchID
                                            )
                                        AND ( @ResetType = 0
                                              OR [SaleTypeID] = @SaleTypeId
                                            )
                            AND
                            (
                                @ResetSaleArea = 0
                                OR [SaleAreaID] = @SaleAreaId
                            )
                             ), @StartNum);
	
   
    IF ( @Number >= @StartNum
         AND ( @EndNum IS NULL
               OR @Number <= @EndNum
             )
       )
        BEGIN  
            INSERT  INTO [SLE].[Remittance]
                    ( [FinancialPeriodID] ,
                      [BaseDocument] ,
                      [SaleTypeID] ,
                      [BranchID] ,
                      [StockID] ,
                      [CustomerID] ,
                      [AddressID] ,
                      [Number] ,
                      [Date] ,
                      [DeadLine] ,
                      [Status] ,
                      [Version] ,
                      [Creator] ,
                      [CreationDate] ,
                      [LastEditor] ,
                      [LastEditionDate],
					  [SaleAreaID]
                    )
                    SELECT  @FinancialPeriodID ,
                            @BaseDocument ,
                            @SaleTypeId ,
                            @BranchID ,
                            @StockID ,
                            @CustomerID ,
                            @AddressID ,
                            @Number ,
                            @Date ,
                            @DeadLine ,
                            @Status ,
                            0 ,
                            @Creator ,
                            @CreationDate ,
                            @LastEditor ,
                            @LastEditionDate,
							@SaleAreaID;
	
	-- Begin Return Select <- do not remove
            SELECT  [RemittanceID] ,
                    [Version],
                    [Number]
            FROM    [SLE].[Remittance]
            WHERE   [RemittanceID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
        END;
    ELSE
        BEGIN					
            SELECT  @Message =  'InvalidNumberRange'
            RAISERROR(@Message,16,12);	
        END;
