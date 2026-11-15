
--==============================================Alter SpReceptionInsert
CREATE   PROC [CTM].[SpReceptionInsert] 
    @Number INT,
    @Date DATE,
    @CustomerID BIGINT,
	@AddressID INT,
	@PhoneID INT,
    @BranchID INT,
    @ReceptionTypeID INT,
    @FinancialPeriodID INT,
    @Creator INT,
    @CreationDate DATETIME
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	
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
	INSERT INTO 
		[CTM].[Reception] ([Number], [Date], [CustomerID], [AddressID], [PhoneID], [BranchID], [ReceptionTypeID], [FinancialPeriodID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT 
		@Number, @Date, @CustomerID, @AddressID, @PhoneID, @BranchID, @ReceptionTypeID, @FinancialPeriodID, 0, @Creator, @CreationDate, @Creator, @CreationDate
		
	-- Begin Return Select <- do not remove
	SELECT 
		[ReceptionID], 
		[Version], 
		[Number]
	FROM   
		[CTM].[Reception]
	WHERE  
		[ReceptionID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
END
