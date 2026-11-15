
CREATE   PROC [ACC].[SpUsedDlTypeInsert] 
    @SaturnModuleID int,
    @DlTypeID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 

--WITH ENCRYPTION 
	 AS 
	SET NOCOUNT ON 

	if exists (select * from [ACC].[UsedDlType] where [SaturnModuleID] = @SaturnModuleID and [DlTypeID] =  @DlTypeID)
	begin
		raiserror('این نوع تفصیل قبلا انتخاب شده است. جهت مشاهده یکبار از برنامه خارج و دوباره وارد شوید.',16,12)
		return
	end
	
	INSERT INTO [ACC].[UsedDlType] ([SaturnModuleID], [DlTypeID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @SaturnModuleID, @DlTypeID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [UsedDlTypeID], [Version]
	FROM   [ACC].[UsedDlType]
	WHERE  [UsedDlTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
