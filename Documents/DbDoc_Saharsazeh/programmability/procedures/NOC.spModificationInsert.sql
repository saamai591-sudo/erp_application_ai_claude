
--==============================================Alter spModificationInsert
CREATE   PROC [NOC].spModificationInsert
(
	@Number INT,
	@Date DATE,
	@Description NVARCHAR(1024),
	@Description2 NVARCHAR(1024),
	@ReportagePeriodID INT,
	@SlID INT,
	@VoucherItemID INT,
	@Creator INT,
	@CreationDate DATETIME,
	@ReportCurrencyRate DECIMAL(30,10),
	@BasePrevoucherID INT
)
--WITH ENCRYPTION 
AS
	IF EXISTS(SELECT * FROM noc.ConfirmedReport
			  WHERE ReportagePeriodID = @ReportagePeriodID AND 
			  type = 2
	)
	BEGIN
		RAISERROR('NIOCReport.ReportOfThePeriodIsConfirmed', 16, 12)
		RETURN
	END  
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
						FROM 
							[NOC].[Modification])
						, 1) 

	INSERT INTO 
		[NOC].[Modification]
	(
		[Number],
		[Date],
		[Description],
		[Description2],
		[ReportagePeriodID],
		[SlID],
		[VoucherItemID],
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate],
		ReportCurrencyRate,
		BasePrevoucherID
	)
	VALUES  
	(
		@Number,
		@Date,
		@Description,
		@Description2,
		@ReportagePeriodID,
		@SlID,
		@VoucherItemID,
		0,
		@Creator,
		@CreationDate,
		@Creator,
		@CreationDate,
		@ReportCurrencyRate,
		@BasePrevoucherID
	)

	SELECT		
		[ModificationID],
		[Version],
		[Number]	
	FROM 
		[NOC].[Modification]
	WHERE 
		[ModificationID] = SCOPE_IDENTITY();
