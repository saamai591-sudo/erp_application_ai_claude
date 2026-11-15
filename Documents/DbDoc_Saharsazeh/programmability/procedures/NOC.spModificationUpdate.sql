
--==============================================Alter spModificationUpdate
CREATE   PROC [NOC].spModificationUpdate
(
	 @ModificationID INT,
	 @Number INT,
	 @Date DATE,
	 @Description NVARCHAR(1024),
	 @Description2 NVARCHAR(1024),
	 @ReportagePeriodID INT,
	 @SlID INT,
	 @VoucherItemID INT,
	 @Version INT,
	 @LastEditor INT,
	 @LastEditionDate DATETIME,
	 @ReportCurrencyRate DECIMAL(30,10),
	 @BasePrevoucherID INT
)
--WITH ENCRYPTION 
AS
	IF @Version <> (SELECT [Version] FROM [NOC].[Modification]
					WHERE ModificationID = @ModificationID)
	BEGIN
		RAISERROR('Version mismatch...', 16, 10)
		RETURN
	END

	IF EXISTS(SELECT * FROM NOC.ConfirmedReport
			  WHERE ReportagePeriodID = @ReportagePeriodID AND 
			  type = 2)
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

	UPDATE 
		[NOC].[Modification]
	SET 
		[Number] = @Number,
		[Date] =@Date,
		[Description] = @Description,
		[Description2] = @Description2,
		[ReportagePeriodID] = @ReportagePeriodID,
		[SlID] = @SlID,
		[VoucherItemID] = @VoucherItemID,
		[Version] = [Version] + 1,
		[LastEditor] = @LastEditor,
		[LastEditionDate] = @LastEditionDate,
		ReportCurrencyRate = @ReportCurrencyRate,
		BasePrevoucherID = @BasePrevoucherID
	WHERE 
		ModificationID = @ModificationID

	SELECT  
		[Version], [Number]
	FROM 
		[NOC].[Modification]
	WHERE 
		[ModificationID] = @ModificationID
