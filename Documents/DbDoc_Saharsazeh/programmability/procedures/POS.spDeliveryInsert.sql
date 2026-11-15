
--==============================================Alter spDeliveryInsert
CREATE   PROC [POS].spDeliveryInsert 
    @FinancialPeriodID INT,
    @StationShiftID INT,
    @OutgoingID INT,
	@ReturnedOutgoingID INT,
    @Number INT,
    @Date DATE,
    @PreVoucherID INT = NULL,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Status TINYINT
AS 
	SET NOCOUNT ON 

	DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		POS.Delivery d
	JOIN 
		POS.StationShift ssh
	ON
		d.StationShiftID = ssh.StationShiftID
	JOIN
		POS.Station s
	ON
		ssh.StationID = s.StationID 
	JOIN
		CFG.Branch b
	ON
		s.BranchID = b.BranchID
	WHERE 
		d.StationShiftID = @StationShiftID
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
						FROM 
							Pos.Delivery d
						JOIN 
							POS.StationShift ssh
						ON
							d.StationShiftID = ssh.StationShiftID
						JOIN
							POS.Station s
						ON
							ssh.StationID = s.StationID 
						JOIN
							CFG.Branch b
						ON
							s.BranchID = b.BranchID
						WHERE 
							d.FinancialPeriodID = @FinancialPeriodID AND 
                            b.CompanyID = @CompanyID)
						, 1) 
    
	INSERT INTO 
		[POS].[Delivery]
	(
		[FinancialPeriodID],
		[StationShiftID],
		[Number],
		[Date],
		PreVoucherID,
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate],
		[Version],
		[Status]
	)
	SELECT 
		@FinancialPeriodID,
		@StationShiftID,
		@Number,
		@Date,
		@PreVoucherID,
		@Creator,
		@CreationDate,
		@LastEditor,
		@LastEditionDate,
		0,
		@Status
	 
	-- Begin Return Select <- do not remove
	SELECT 
		DeliveryID,
		[Version],
		[Number]
	FROM   
		[POS].[Delivery]
	WHERE  
		[DeliveryID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
