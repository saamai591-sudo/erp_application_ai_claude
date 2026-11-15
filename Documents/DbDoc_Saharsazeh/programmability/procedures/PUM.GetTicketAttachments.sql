
CREATE   PROCEDURE [PUM].[GetTicketAttachments]
(
    @engName NVARCHAR(200),
    @entityId NVARCHAR(MAX),
    @metaDataKey NVARCHAR(200)
)
as
BEGIN
    -- this proc is currently is use only in managment front not the portal front
    -- so @userId actually is the CFG.User.UserID

     DECLARE @userId INT,
            @Culture NVARCHAR(20),
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10);;

    SET @Culture = CFG.GetuserCulture();
    SET @userId = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @userId;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';



    with files as(
    select EngName='Ticket',t.TicketId,TicketExperId=t.ExpertID,TicketAnswerID=null,fa.*,
    
            CreatorInternalUserID=iu1.InternalUserID,
            CreatorUserId=null,
            Creator_UserName=iu1.Username,
            CreatorUserName=iu1.Title ,

            EditorInternalUserID=iu2.InternalUserID,
            EditorUserId=null,
            Editor_UserName=iu2.Username,
            EditorName=iu2.Title 

    from CFG.FileAttachment fa
    join PUM.Ticket t on t.TicketID = fa.EntityRelatedID 
    join MDT.DmdEntity e on e.ID=fa.MetaDataEntityID
    join pum.InternalUser iu1 on iu1.InternalUserID=fa.Creator
    join pum.InternalUser iu2 on iu2.InternalUserID=fa.LastEditor
    where e.Name = 'Ticket'

    union

    select EngName='TicketAnswer',t.TicketId,TicketExperId=t.ExpertID,ta.TicketAnswerID,fa.*,
    
            CreatorInternalUserID=iu1.InternalUserID,
            CreatorUserId=u1.UserId,
            Creator_UserName=isnull(u1.Username,iu1.Username),
            CreatorUserName=isnull(u1.Name,iu1.Title) ,

            EditorInternalUserID=iu2.InternalUserID,
            EditorUserId=u2.UserId,
            Editor_UserName=isnull(u2.Username,iu2.Username),
            EditorName=isnull(u2.Name,iu2.Title) 

    from CFG.FileAttachment fa
    join PUM.TicketAnswer ta on ta.TicketAnswerID=fa.EntityRelatedID
    join PUM.Ticket t on t.TicketID =  ta.TicketID
    join MDT.DmdEntity e on e.ID=fa.MetaDataEntityID
    left join pum.InternalUser iu1 on iu1.InternalUserID=fa.Creator and ta.InternalUserID is not null
    left join CFG.[User] u1 on u1.UserID=fa.Creator and ta.ExpertID is not null

    left join pum.InternalUser iu2 on iu2.InternalUserID=fa.LastEditor and ta.InternalUserID is not null
    left join CFG.[User] u2 on u2.UserID=fa.LastEditor and ta.ExpertID is not null

    where e.Name = 'TicketAnswer' 
    )

    select f.*,
            CFG.GetCLRSaturnDate(f.[Date], @DateFormat, 0, @DateType) AS PersianDate,
	        CFG.GetCLRSaturnDate(f.[CreationDate], @DateFormat, 0, @DateType) AS CreateDateString,
	        CFG.GetCLRSaturnDate(f.[LastEditionDate], @DateFormat, 0, @DateType) AS EditionDateString,
            t.title As FileAttachmentType,
            ModuleKey=''
    from files f
    left join CFG.FileAttachmentType t on t.FileAttachmentTypeID=f.FileAttachmentTypeID
    where
    
            (
                f.TicketID=         (case @engName when 'Ticket'        then @entityId end) or 
                f.TicketAnswerID=   (case @engName when 'TicketAnswer'  then @entityId end)    
            )

            and (@userId=-1 or (F.TicketExperId is null or f.TicketExperId=@userId))


    order by FileAttachmentID 
END
