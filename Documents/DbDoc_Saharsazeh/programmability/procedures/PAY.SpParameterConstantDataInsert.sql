CREATE PROC [PAY].[SpParameterConstantDataInsert] 
    @ParameterID int,
    @PersonnelID int,
    @CalendarMonthID int,
    @Value decimal(30, 4),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	IF Pay.HasCalculationAfter(@PersonnelID,@CalendarMonthID,@ParameterID)=1
		BEGIN
			RAISERROR (N'براي اين فرد محاسبه انجام شده است', -- Message text.
			16, -- Severity,
			12 ); -- Second argument.)
			return
		END

	IF EXISTS (SELECT pcd.ParameterConstantDataID
	             FROM pay.ParameterConstantData pcd
	           WHERE pcd.PersonnelID=@PersonnelID
	           AND pcd.ParameterID=@ParameterID
	           AND pcd.CalendarMonthID=@CalendarMonthID
	)
	BEGIN
		BEGIN
			RAISERROR (N'اطلاعات وارد شده تکراري مي باشد', -- Message text.
			16, -- Severity,
			12 ); -- Second argument.)
			return
		END
	END
	
	INSERT INTO [PAY].[ParameterConstantData] ([ParameterID], [PersonnelID], [CalendarMonthID], [Value], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ParameterID, @PersonnelID, @CalendarMonthID, @Value, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ParameterConstantDataID], [Version]
	FROM   [PAY].[ParameterConstantData]
	WHERE  [ParameterConstantDataID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
