
CREATE   PROC ATN.spMissionRequestInsert 
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
    @Creator INT,
    @CreationDate DATETIME,
	@EffectiveDate Date
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

	INSERT INTO 
		ATN.MissionRequest (Number, [Date], RequestTypeID, StartDate, EndDate, StartHour, EndHour, PersonelID,
							[Description], Description2, [Status], Creator, CreationDate, LastEditor, LastEditionDate, [Version], EffectiveDate)
	SELECT 
		@Number, @Date, @RequestTypeID, @StartDate, @EndDate, @StartHour, @EndHour, @PersonelID,
		@Description, @Description2, @Status, @Creator, @CreationDate, @Creator, @CreationDate, 0, @EffectiveDate
	
	-- Begin Return Select <- do not remove
	SELECT 
		MissionRequestID, 
		[Version], 
		Number
	FROM   
		ATN.MissionRequest
	WHERE  
		MissionRequestID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove

