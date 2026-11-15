CREATE     PROC [ATN].[spAttendanceGroupUpdate]
    @AttendanceGroupID int,
    @Code int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
	@AttendanceGroupTypeID int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION 
AS 

    IF @Version <>
    (
        SELECT [Version]
        FROM [ATN].AttendanceGroup 
        WHERE AttendanceGroupID = @AttendanceGroupID
    )
	begin
		RAISERROR('Version mismatch...', 16, 10);
	end       	 

	UPDATE [ATN].AttendanceGroup
	SET    Code = @Code,
	       [Title] = @Title, 
	       [Title2] = @Title2, 
		   AttendanceGroupTypeID = @AttendanceGroupTypeID,
	       [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  AttendanceGroupID = @AttendanceGroupID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   ATN.AttendanceGroup
	WHERE  AttendanceGroupID = @AttendanceGroupID
	-- End Return Select <- do not remove
