CREATE      PROC [CTM].[spOrderUpdate]
    @OrderID INT ,
    @FinancialPeriodID INT ,
    @SaleTypeId INT ,
    @BranchID INT ,
    @CustomerID BIGINT ,
    @AddressID INT ,
    @Number INT ,
    @Date DATETIME ,
    @Status TINYINT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@SaleAreaID int  
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON; 

	if @SaleAreaID is null
		set @SaleAreaID = -1

    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [CTM].[Order]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                             ), 1);

    IF @Version <> ( SELECT [Version]
                     FROM   [CTM].[Order]
                     WHERE  [OrderID] = @OrderID
                   )
    BEGIN
        RAISERROR('Version mismatch...', 16 , 10);
        RETURN 0;
    END;

    UPDATE  [CTM].[Order]
    SET     [SaleTypeID] = @SaleTypeId ,
            [BranchID] = @BranchID ,
            [CustomerID] = @CustomerID ,
            [AddressID] = @AddressID ,
            [Number] = @Number ,
            [Date] = @Date ,
            [Status] = @Status ,
            [Version] = @Version + 1 ,
            [LastEditor] = @LastEditor ,
            [LastEditionDate] = @LastEditionDate,
			SaleAreaID = @SaleAreaID
    WHERE   [OrderID] = @OrderID;
	
		-- Begin Return Select <- do not remove
    SELECT  [Version], [Number]
    FROM    [CTM].[Order]
    WHERE   [OrderID] = @OrderID;	
		-- End Return Select <- do not remove
END
