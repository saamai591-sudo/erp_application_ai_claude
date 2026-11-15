CREATE      PROC [CTM].[spOrderInsert]
    @FinancialPeriodID INT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @Status TINYINT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaID int
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON; 
    SET XACT_ABORT ON;  
	
	if @SaleAreaID is null
	set @SaleAreaID = -1

    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [CTM].[Order]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                             ), 1);
		
    INSERT  INTO [CTM].[Order]
            ( [FinancialPeriodID] ,
              [SaleTypeID] ,
              [BranchID] ,
              [CustomerID] ,
              [AddressID] ,
              [Number] ,
              [Date] ,
              [Status] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate],
			  [SaleAreaID]
            )
            SELECT  @FinancialPeriodID ,
                    @SaleTypeId ,
                    @BranchID ,
                    @CustomerID ,
                    @AddressID ,
                    @Number ,
                    @Date ,
                    @Status ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate,
					@SaleAreaID;
	
	-- Begin Return Select <- do not remove
    SELECT  [OrderID],
            [Version],
            [Number]
    FROM    [CTM].[Order]
    WHERE   [OrderID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
