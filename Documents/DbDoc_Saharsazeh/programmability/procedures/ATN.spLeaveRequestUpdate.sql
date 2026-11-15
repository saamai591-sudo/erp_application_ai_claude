
CREATE   PROC ATN.spLeaveRequestUpdate
    @LeaveRequestID INT,  	
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
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
	@LeaveBalance DECIMAL(36,10),
	@RequestedLeave DECIMAL(36,10),
	@FinalBalance DECIMAL(36,10)
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON

	DECLARE 
		@PreviousStatus TINYINT,
		@CompanyID INT

	SELECT 
		@CompanyID = p.CompanyID 
	FROM 
		HRM.Personel p 
	WHERE 
		p.PersonelID = @PersonelID

	SELECT 
		@PreviousStatus = [Status] 
	FROM 
		ATN.LeaveRequest 
	WHERE 
		LeaveRequestID = @LeaveRequestID

	IF ((@Status = 2 AND @PreviousStatus = 2) OR (@Status = 3 AND @PreviousStatus = 3))
	BEGIN
		RAISERROR('AttendanceManagement.Messages.RequestIsNotEditable',16,12)
		RETURN
	END

	IF @Version = (SELECT [Version] FROM ATN.LeaveRequest
				   WHERE LeaveRequestID = @LeaveRequestID)
	BEGIN	
		DECLARE 
			@Duration DECIMAL(18, 0) = @RequestedLeave

		EXEC 
			ATN.spGetRequestDuration @PersonelID, @StartDate, @EndDate, @StartHour, @EndHour, @Duration OUTPUT

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
		BEGIN			
		SET 
			@Version = @Version + 1 

		UPDATE 
			ATN.LeaveRequest
		SET    
			Number = @Number,
		    [Date] = @Date, 
			RequestTypeID = @RequestTypeID, 
			StartDate = @StartDate,
	        EndDate = @EndDate,
	        StartHour = @StartHour,
	        EndHour = @EndHour,
			PersonelID = @PersonelID,
			LeaveEntityType = @LeaveEntityType,
			[Description] = @Description,
			Description2 = @Description2,
			[Status] = @Status,
			[ReviewerID] = @ReviewerID, 
			[ReviewDate] = @ReviewDate,
			LastEditor = @LastEditor, 
			LastEditionDate = @LastEditionDate, 
			[Version] = @Version,
			LeaveBalance = @LeaveBalance,
			RequestedLeave = @RequestedLeave,
			FinalBalance = @FinalBalance
		WHERE  
			LeaveRequestID = @LeaveRequestID
	
			-- Begin Return Select <- do not remove
			SELECT 
				Number, 
				[Version],
				FinalBalance, 
				RequestedLeave
			FROM   
				ATN.LeaveRequest
			WHERE  
				LeaveRequestID = @LeaveRequestID	
			-- End Return Select <- do not remove
		END
	END
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)

