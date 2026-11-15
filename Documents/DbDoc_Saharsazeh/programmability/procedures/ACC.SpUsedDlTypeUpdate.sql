

CREATE   PROC [ACC].[SpUsedDlTypeUpdate] 
    @UsedDlTypeID int,
    @SaturnModuleID int,
    @DlTypeID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime

--WITH ENCRYPTION 
	 AS 
SET NOCOUNT ON 


	if exists (select * from [ACC].[UsedDlType] 
	where [SaturnModuleID] = @SaturnModuleID 
	and [DlTypeID] =  @DlTypeID
	and UsedDlTypeID <> @UsedDlTypeID)
	begin
	raiserror('این نوع تفصیل قبلا انتخاب شده است. جهت مشاهده یکبار از برنامه خارج و دوباره وارد شوید.',16,12)
	return
	end

	if @Version <> (Select [Version] from [ACC].[UsedDlType]
				where [UsedDlTypeID] = @UsedDlTypeID)
				begin
	RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

		UPDATE [ACC].[UsedDlType]
		SET    [SaturnModuleID] = @SaturnModuleID, [DlTypeID] = @DlTypeID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [UsedDlTypeID] = @UsedDlTypeID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [ACC].[UsedDlType]
		WHERE  [UsedDlTypeID] = @UsedDlTypeID	
		-- End Return Select <- do not remove
