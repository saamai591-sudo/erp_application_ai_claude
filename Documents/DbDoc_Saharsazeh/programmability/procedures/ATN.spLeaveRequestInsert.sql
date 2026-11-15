
CREATE   PROC ATN.spLeaveRequestInsert   
    @Number INT, 
	@Date DATE,
	@RequestTypeID INT,
	@StartDate DATE,
	@EndDate DATE,
	@StartHour DECIMAL(18,0),
	@EndHour DECIMAL(18,0),
	@PersonelID INT,
	@LeaveEntityType TINYINT,
	@Description NVARCHAR(MAX),
	@Description2 NVARCHAR(MAX),
	@Status TINYINT,
	@ReviewerID INT,
	@ReviewDate DATETIME,
    @Creator INT,
    @CreationDate DATETIME,
	@LeaveBalance DECIMAL(36,10),
	@RequestedLeave DECIMAL(36,10),
	@FinalBalance DECIMAL(36,10)
--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON

	DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = p.CompanyID 
	FROM 
		HRM.Personel p 
	WHERE 
		p.PersonelID = @PersonelID

	EXEC 
		ATN.spGetRequestDuration @PersonelID, @StartDate, @EndDate, @StartHour, @EndHour, @Duration = @RequestedLeave OUTPUT

	SET 
		@FinalBalance = @LeaveBalance - @RequestedLeave

	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
                         FROM 
							ATN.LeaveRequest lr
						 JOIN 
							HRM.Personel p 
						 ON 
							lr.PersonelID = p.PersonelID
						 WHERE 
							p.CompanyID = @CompanyID)
					  , 1) 

	INSERT INTO 
		ATN.LeaveRequest (Number, [Date], RequestTypeID, StartDate, EndDate, StartHour, EndHour, PersonelID, LeaveEntityType,
						  [Description], Description2, [Status], [ReviewerID], [ReviewDate], Creator, CreationDate, LastEditor, 
						  LastEditionDate, [Version],LeaveBalance,RequestedLeave,FinalBalance)
	SELECT 
		@Number, @Date, @RequestTypeID, @StartDate, @EndDate, @StartHour, @EndHour, @PersonelID, @LeaveEntityType,
		@Description, @Description2, @Status, @ReviewerID, @ReviewDate, @Creator, @CreationDate, @Creator, @CreationDate, 
		0,@LeaveBalance,@RequestedLeave,@FinalBalance
	
	-- Begin Return Select <- do not remove
	SELECT 
		LeaveRequestID, 
		[Version], 
		Number, 
		FinalBalance, 
		RequestedLeave
	FROM   
		ATN.LeaveRequest
	WHERE  
		LeaveRequestID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

