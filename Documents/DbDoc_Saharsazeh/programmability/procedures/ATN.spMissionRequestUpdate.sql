
CREATE   PROC ATN.spMissionRequestUpdate
    @MissionRequestID INT,  	
	@Number INT, 
	@Date DATE,
	@RequestTypeID INT,
	@StartDate DATE,
	@EndDate DATE,
	@StartHour DECIMAL(18,0),
	@EndHour DECIMAL(18,0),
	@PersonelID INT,
	@Description NVARCHAR(MAX),
	@Description2 NVARCHAR(MAX),
	@Status TINYINT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
	@EffectiveDate DATE
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

	IF @Version = (
		SELECT [Version] FROM ATN.MissionRequest
	WHERE 
		MissionRequestID = @MissionRequestID)
	BEGIN	

		IF(@Number = 0 OR @Number IS NULL)
		SET 
			@Number = ISNULL(
							(SELECT 
								MAX(Number) + 1
							 FROM 
								ATN.MissionRequest mr
							 JOIN 
								HRM.Personel p 
							 ON 
								mr.PersonelID = p.PersonelID
							 WHERE 
								p.CompanyID = @CompanyID)
							, 1) 
		SET 
			@Version = @Version + 1 

		UPDATE 
			ATN.MissionRequest
		SET 
			Number = @Number,
		    [Date] = @Date, 
			RequestTypeID = @RequestTypeID, 
			StartDate = @StartDate,
	        EndDate = @EndDate,
	        StartHour = @StartHour,
	        EndHour = @EndHour,
			PersonelID = @PersonelID,
			[Description] = @Description,
			Description2 = @Description2,
			[Status] = @Status,
			LastEditor = @LastEditor, 
			LastEditionDate = @LastEditionDate, 
			[Version] = @Version,
			EffectiveDate = @EffectiveDate
		WHERE  
			MissionRequestID = @MissionRequestID
	
		-- Begin Return Select <- do not remove
		SELECT  
			[Version],
			Number
		FROM   
			ATN.MissionRequest
		WHERE  
			MissionRequestID = @MissionRequestID	
		-- End Return Select <- do not remove
	END
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
