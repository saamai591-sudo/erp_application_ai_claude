CREATE     PROC [ATN].[spMissionTypeUpdate]
    @MissionTypeID int,  	
	@Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@RequestTypeID int
--WITH ENCRYPTION
AS 
    if exists (select 1 from ATN.MissionReport where MissionTypeID = @MissionTypeID)
	begin
		RAISERROR('AttendanceManagement.Messages.MissionTypeUsed', 16, 12);
		return
	end

	if @Version = (Select [Version] from ATN.MissionType
	where MissionTypeID = @MissionTypeID)
	begin	
		if (@Code is null or @Code = 0)
		begin
			set @Code = isnull((select MAX(Code) from ATN.MissionType),0) + 1
		end

		UPDATE ATN.MissionType
		SET    Code = @Code,
		       Title = @Title, 
			   Title2 = @Title2, 
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version + 1,
			   RequestTypeID = @RequestTypeID
		WHERE  MissionTypeID = @MissionTypeID
	
		-- Begin Return Select <- do not remove
		SELECT Code, [Version]
		FROM   ATN.MissionType
		WHERE  MissionTypeID = @MissionTypeID	
		-- End Return Select <- do not remove
	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
