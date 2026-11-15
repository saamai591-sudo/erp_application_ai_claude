
--==============================================Alter SpReceptionUpdate
CREATE   PROC [CTM].[SpReceptionUpdate] 
    @ReceptionID INT,
    @Number INT,
    @Date date,
    @CustomerID bigint,
    @AddressID INT,
	@PhoneID INT,
    @BranchID INT,
    @ReceptionTypeID INT,
    @FinancialPeriodID INT,
    @Version INT,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON
	
	IF @Version <> (SELECT [Version] FROM [CTM].[Reception]
					WHERE [ReceptionID] = @ReceptionID)
	BEGIN
		RAISERROR('Version mismatch...', 16 , 10)
		RETURN 0
	END
		
	DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		CFG.Branch b 
	WHERE 
		b.BranchID = @BranchID

	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
                         FROM 
							[CTM].[reception] r
						 JOIN 
							CFG.Branch b 
						 ON 
							r.BranchID = b.BranchID
						 WHERE 
							r.FinancialPeriodID = @FinancialPeriodID AND 
							b.CompanyID = @CompanyID)
						, 1) 
	SET 
		@Version = @Version + 1 

	UPDATE 
		[CTM].[Reception]
	SET
		[Number] = @Number,
		[Date] = @Date, 
		[CustomerID] = @CustomerID, 
		[AddressID] = @AddressID,
		[PhoneID] = @PhoneID,
		[BranchID] = @BranchID, 
		[ReceptionTypeID] = @ReceptionTypeID, 
		[FinancialPeriodID] = @FinancialPeriodID, 
		[Version] = @Version, 
		[LastEditor] = @LastEditor, 
		[LastEditionDate] = @LastEditionDate
	WHERE  
		[ReceptionID] = @ReceptionID
	
	-- Begin Return Select <- do not remove
	SELECT  
		[Version], 
		[Number]
	FROM   
		[CTM].[Reception]
	WHERE  
		[ReceptionID] = @ReceptionID	
	-- End Return Select <- do not remove
END
